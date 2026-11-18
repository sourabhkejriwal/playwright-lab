import { getCollection, type CollectionEntry } from 'astro:content';
import { chapters, pad, type ChapterMeta } from '../data/chapters';

export interface ChapterWithStatus extends ChapterMeta {
  status: 'passed' | 'pending';
  entry?: CollectionEntry<'chapters'>;
  href: string; // path without base; pass through url()
}

/** All 16 chapters joined with their MDX entry (if written). Drafts count as pending. */
export async function getChapters(): Promise<ChapterWithStatus[]> {
  const entries = await getCollection('chapters');
  return chapters.map((meta) => {
    const entry = entries.find((e) => e.data.chapter === meta.num);
    const written = entry && !entry.data.draft;
    return {
      ...meta,
      entry,
      status: written ? 'passed' : 'pending',
      href: `chapters/${pad(meta.num)}-${meta.slug}`,
    };
  });
}
