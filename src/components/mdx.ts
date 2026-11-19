// Components available in every chapter MDX file without an import.
// `table` overrides the HTML that Markdown tables render to.
import ApiRef from './ApiRef.astro';
import Callout from './Callout.astro';
import Kbd from './Kbd.astro';
import TableScroll from './TableScroll.astro';

export const mdxComponents = { ApiRef, Callout, Kbd, table: TableScroll };
