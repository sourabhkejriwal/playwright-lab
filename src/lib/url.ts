/**
 * Prefix an internal path with the deploy base (e.g. "/playwright-lab" on GitHub Pages).
 * Always use this for internal links and assets; never hard-code a leading "/".
 */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return clean ? `${base}/${clean}` : `${base}/`;
}
