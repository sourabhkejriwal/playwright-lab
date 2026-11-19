/**
 * The app behind the "spot the flaky test" challenges. `tests/flaky-challenges.spec.ts` copies this file into a temporary
 * project. FLAKY_TIMING=kind makes every race fall the lucky way and FLAKY_TIMING=hostile the unlucky way.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { test as base, expect, type Locator, type Page, type Route } from '@playwright/test';

const hostile = process.env.FLAKY_TIMING === 'hostile';
const orders = new Set<string>();

const html = (body: string, script = ''): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>shop</title></head><body>${body}<script>${script}</script></body></html>`;

const pages: Record<string, () => string> = {
  '/profile': () =>
    html(
      '<button>Save</button><p role="status"></p>',
      `const status = document.querySelector('[role=status]');
       document.querySelector('button').onclick = () => {
         ${hostile ? `status.textContent = 'Saving…'; setTimeout(() => (status.textContent = 'Saved'), 800);` : `status.textContent = 'Saved';`}
       };`,
    ),
  '/reports': () =>
    html(
      '<table></table>',
      `setTimeout(() => {
         document.querySelector('table').innerHTML = '<tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr>';
       }, ${hostile ? 1200 : 50});`,
    ),
  '/orders': () => html(`<img alt="" src="/slow.gif"><p>orders</p>`, `fetch('/api/orders');`),
  '/orders/new': () =>
    html(
      '<button>Place order</button>',
      `document.querySelector('button').onclick = async () => {
         const { id } = await (await fetch('/api/orders', { method: 'POST' })).json();
         location.href = '/orders/' + id;
       };`,
    ),
  '/cart': () => {
    const banner = `<div role="dialog" aria-label="Cookies" style="position:fixed;inset:0;background:#fff"><button>Accept</button></div>`;
    const link = '<a href="/checkout">Checkout</a>';
    const accept = `document.querySelector('[role=dialog] button').onclick = () => document.querySelector('[role=dialog]').remove();`;
    if (!hostile) return html(link + banner, accept);
    // Shown by `bannerArrivesOnFirstClick`, not a timer: on a busy machine `isVisible()` could run after any fixed delay.
    return html(
      link,
      `window.showBanner = () => {
         window.showBanner = () => {};
         document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(banner)});
         ${accept}
       };`,
    );
  },
  '/checkout': () => html('<h1>Checkout</h1>'),
  '/invoices': () => {
    const item = (id: number): string => `<li><a href="/invoices/${id}">Invoice ${id}</a></li>`;
    if (!hostile) return html(`<ul>${item(1042)}${item(1041)}</ul>`);
    return html(
      `<ul>${item(1041)}${item(1042)}</ul>`,
      `setTimeout(() => { const list = document.querySelector('ul'); list.prepend(list.lastElementChild); }, 600);`,
    );
  },
  '/invoices/1041': () => html('<h1>Invoice 1041</h1>'),
  '/invoices/1042': () => html('<h1>Invoice 1042</h1>'),
  '/dashboard': () =>
    html(
      '<h1></h1>',
      `document.querySelector('h1').textContent = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon';`,
    ),
};

async function respond(route: Route): Promise<void> {
  const request = route.request();
  const path = new URL(request.url()).pathname;

  if (path === '/slow.gif') {
    // A slow image holds back the load event, so the API answers while `goto` is still waiting.
    if (hostile) await sleep(500);
    return route.fulfill({
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64'),
    });
  }
  if (path === '/api/orders' && request.method() === 'POST') {
    const id = `A-${orders.size + 1}`;
    orders.add(id);
    return route.fulfill({ json: { id } });
  }
  if (path === '/api/orders') {
    if (!hostile) await sleep(500);
    return route.fulfill({ json: [] });
  }
  const order = path.match(/^\/orders\/(A-\d+|undefined)$/)?.[1];
  if (order) {
    const heading = orders.has(order) ? `Order ${order}` : 'Order not found';
    return route.fulfill({ contentType: 'text/html', body: html(`<h1>${heading}</h1>`) });
  }
  const page = pages[path];
  if (page) return route.fulfill({ contentType: 'text/html', body: page() });
  return route.fulfill({ status: 404, body: '' });
}

let clicksPatched = false;

/** Hostile timing for the cart: the banner lands after any earlier check, just as the first click starts. */
function bannerArrivesOnFirstClick(page: Page): void {
  if (clicksPatched) return;
  clicksPatched = true;
  const locator = Object.getPrototypeOf(page.locator('body')) as Locator;
  const click = locator.click;
  locator.click = async function (this: Locator, ...args: Parameters<Locator['click']>) {
    await this.page().evaluate('window.showBanner?.()');
    return click.apply(this, args);
  };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    if (hostile) bannerArrivesOnFirstClick(page);
    // The time of day the run happens to start at: the greeting challenge depends on it.
    await page.clock.setFixedTime(new Date(`2026-03-02T${hostile ? '15' : '09'}:00:00`));
    await page.route('**/*', (route) => respond(route).catch(() => {}));
    await use(page);
  },
});

export { expect };
export type { Page };
