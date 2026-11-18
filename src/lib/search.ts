// The parts of Pagefind's browser API the search dialog uses, and how its results become dialog rows.
// Pure, so the rules can be tested without a browser.

export interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
  sub_results?: PagefindSubResult[];
}

export interface Pagefind {
  options(options: { baseUrl: string }): Promise<void>;
  init(): Promise<void>;
  /** Resolves to null when a newer search replaced this one during the wait. */
  debouncedSearch(
    query: string,
    options?: object,
    wait?: number,
  ): Promise<{ results: { data(): Promise<PagefindResultData> }[] } | null>;
}

export interface SearchHit {
  href: string;
  page: string;
  /** The heading the match sits under; null when the match is in the page's opening text. */
  section: string | null;
  excerpt: string;
}

export interface ExcerptPart {
  text: string;
  match: boolean;
}

export const MAX_PAGES = 6;
const MAX_SECTIONS_PER_PAGE = 3;

/** One row per matching section, best pages first, so a result can jump straight to its heading. */
export function toHits(pages: PagefindResultData[]): SearchHit[] {
  const seen = new Set<string>();
  return pages.flatMap((result) => {
    const page = result.meta.title ?? result.url;
    const sections = result.sub_results?.length ? result.sub_results : [{ ...result, title: page }];
    return sections.slice(0, MAX_SECTIONS_PER_PAGE).flatMap((sub) => {
      if (seen.has(sub.url)) return [];
      seen.add(sub.url);
      return [
        { href: sub.url, page, section: sub.url.includes('#') ? sub.title : null, excerpt: sub.excerpt },
      ];
    });
  });
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity]);
}

/** Splits Pagefind's `<mark>` excerpt into plain text pieces, so the dialog never has to render its HTML. */
export function excerptParts(excerpt: string): ExcerptPart[] {
  return excerpt
    .split(/(<mark>.*?<\/mark>)/)
    .filter(Boolean)
    .map((part) => {
      const match = part.startsWith('<mark>');
      return { text: decode(match ? part.slice(6, -7) : part), match };
    });
}
