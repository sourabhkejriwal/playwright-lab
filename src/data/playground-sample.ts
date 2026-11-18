/**
 * The practice page shown in the playground's iframe. It embeds tokens.css, passed in by the caller, so its colors
 * follow the site's themes without a second palette.
 */

const PRODUCT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Crect width='40' height='24' fill='gray'/%3E%3C/svg%3E";

interface Product {
  name: string;
  price: string;
  alt: string;
  soldOut?: boolean;
}

const PRODUCTS: Product[] = [
  { name: 'Canvas Tote', price: '$32', alt: 'Natural canvas tote bag' },
  { name: 'Trail Mug', price: '$18', alt: 'Enamel camping mug' },
  { name: 'Trail Mug Lid', price: '$6', alt: 'Silicone mug lid' },
  { name: 'Pocket Notebook', price: '$9', alt: 'Small ruled notebook', soldOut: true },
];

const ORDERS = [
  ['#1041', 'Shipped', '$32'],
  ['#1042', 'Processing', '$24'],
  ['#1043', 'Delivered', '$20'],
];

const productCards = PRODUCTS.map(
  (product) => `
        <li class="card" data-testid="product-card">
          <img src="${PRODUCT_IMAGE}" alt="${product.alt}" width="120" height="72" />
          <h3>${product.name}</h3>
          <p class="price">${product.price}</p>
          ${
            product.soldOut
              ? '<button type="button" disabled>Sold out</button>'
              : '<button type="button">Add to cart</button>'
          }
        </li>`,
).join('');

const orderRows = ORDERS.map(
  ([id, status, total]) => `
          <tr>
            <td>${id}</td>
            <td>${status}</td>
            <td>${total}</td>
            <td><button type="button">View</button></td>
          </tr>`,
).join('');

const STYLES = `
  * { box-sizing: border-box; }
  html { background: var(--term-surface); }
  body { margin: 0; color: var(--term-text); font: 14px/1.5 system-ui, sans-serif; }
  a { color: var(--term-info); }
  h1, h2, h3 { margin: 0; color: var(--term-bright); line-height: 1.25; }
  h1 { font-size: 22px; }
  h2 { font-size: 17px; }
  h3 { font-size: 14px; }
  p { margin: 0; }
  ul { margin: 0; padding: 0; list-style: none; }
  .site { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 16px; border-bottom: 1px solid var(--term-line); }
  .brand { color: var(--term-bright); font-weight: 700; text-decoration: none; }
  .site ul { display: flex; gap: 12px; }
  .site form { display: flex; gap: 6px; margin-left: auto; }
  main { display: grid; gap: 28px; padding: 16px; }
  section { display: grid; gap: 12px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .card { display: grid; gap: 6px; align-content: start; padding: 10px; border: 1px solid var(--term-line); border-radius: 6px; background: var(--term-raised); }
  .card img { display: block; width: 100%; height: 56px; object-fit: cover; border-radius: 4px; }
  .price { color: var(--term-muted); }
  button { padding: 4px 10px; border: 1px solid var(--term-line-strong); border-radius: 6px; background: var(--term-raised); color: var(--term-bright); font: inherit; cursor: pointer; }
  button:disabled { color: var(--term-muted); cursor: not-allowed; }
  input, select { width: 100%; padding: 5px 8px; border: 1px solid var(--term-line-strong); border-radius: 6px; background: var(--term-surface); color: var(--term-text); font: inherit; }
  input[type='checkbox'], input[type='radio'] { width: auto; }
  input::placeholder { color: var(--term-muted); opacity: 1; }
  .site input { width: 150px; }
  table { width: 100%; border-collapse: collapse; }
  caption { margin-bottom: 6px; color: var(--term-muted); text-align: left; }
  th, td { padding: 6px 8px; border-bottom: 1px solid var(--term-line); text-align: left; }
  th { color: var(--term-bright); }
  .fields { display: grid; gap: 10px; max-width: 340px; }
  .field { display: grid; gap: 3px; }
  .check { display: flex; align-items: center; gap: 6px; }
  fieldset { display: flex; gap: 14px; margin: 0; padding: 6px 10px 8px; border: 1px solid var(--term-line); border-radius: 6px; }
  legend { padding: 0 4px; color: var(--term-muted); }
  footer { padding: 12px 16px; border-top: 1px solid var(--term-line); color: var(--term-muted); }

  [data-pl-overlay] { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; }
  .pl-box { position: absolute; border: 2px solid var(--pl-color); border-radius: 3px; background: color-mix(in srgb, var(--pl-color) 16%, transparent); }
  .pl-box[data-state='match'] { --pl-color: var(--term-pass); }
  .pl-box[data-state='strict'] { --pl-color: var(--term-fail); }
  .pl-box[data-state='target'] { --pl-color: var(--term-purple); border-style: dashed; background: none; }
  .pl-badge { position: absolute; top: -2px; left: -2px; padding: 0 4px; background: var(--pl-color); color: var(--term-bg); font: 700 10px/14px ui-monospace, monospace; }
`;

/** The full document for the iframe's srcdoc. */
export function buildSamplePage(tokensCss: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Fieldnote Supply (sample page)</title>
    <style>${tokensCss}${STYLES}</style>
  </head>
  <body>
    <header class="site">
      <a class="brand" href="#top">Fieldnote Supply</a>
      <nav aria-label="Main">
        <ul>
          <li><a href="#shop">Shop</a></li>
          <li><a href="#orders">Orders</a></li>
          <li><a href="#account">Account</a></li>
        </ul>
      </nav>
      <form role="search" aria-label="Site search">
        <input type="search" aria-label="Search products" placeholder="Search the shop" />
        <button type="button">Search</button>
      </form>
    </header>

    <main id="top">
      <p hidden>Free shipping on orders over $50</p>

      <section id="shop" aria-labelledby="shop-title">
        <h1 id="shop-title">Field kit</h1>
        <ul class="cards" aria-label="Products">${productCards}
        </ul>
      </section>

      <section id="orders" aria-labelledby="orders-title">
        <h2 id="orders-title">Recent orders</h2>
        <p data-testid="order-summary">3 orders, $76 total</p>
        <table>
          <caption>Your last three orders</caption>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Status</th>
              <th scope="col">Total</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>${orderRows}
          </tbody>
        </table>
      </section>

      <section id="account" aria-labelledby="account-title">
        <h2 id="account-title">Sign in</h2>
        <form class="fields" aria-labelledby="account-title">
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" type="email" placeholder="you@example.com" autocomplete="off" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" autocomplete="off" />
          </div>
          <div class="field">
            <label for="country">Country</label>
            <select id="country">
              <option>Canada</option>
              <option>India</option>
              <option>Norway</option>
            </select>
          </div>
          <fieldset>
            <legend>Delivery</legend>
            <label class="check"><input type="radio" name="delivery" checked /> Standard</label>
            <label class="check"><input type="radio" name="delivery" /> Express</label>
          </fieldset>
          <label class="check"><input type="checkbox" /> Remember me</label>
          <button type="button" data-testid="sign-in-submit">Sign in</button>
          <a href="#account">Forgot password?</a>
        </form>
      </section>

      <details>
        <summary>Shipping questions</summary>
        <p>Orders leave the warehouse within two days.</p>
      </details>
    </main>

    <footer>
      <a href="#top">Back to top</a>
    </footer>
  </body>
</html>`;
}
