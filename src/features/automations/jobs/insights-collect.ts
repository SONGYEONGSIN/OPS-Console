export const MIN_VIEW_COUNT = 10_000;
export const MAX_UPSERT_PER_RUN = 10;
export const PUBLISHED_AFTER_DAYS = 14;
export const VIDEOS_LIST_BATCH = 50;
export const CLEANUP_DAYS = 60;

export type CollectedVideo = {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
  description: string | null;
  keyword: string;
  view_count?: number;
};

export function batchIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

export function dedupeByVideoId(items: CollectedVideo[]): CollectedVideo[] {
  const map = new Map<string, CollectedVideo>();
  for (const it of items) {
    if (!it.video_id) continue;
    if (!map.has(it.video_id)) map.set(it.video_id, it);
  }
  return Array.from(map.values());
}

export function filterPopular(rows: CollectedVideo[], minViews: number): CollectedVideo[] {
  return rows.filter((r) => r.view_count == null || r.view_count >= minViews);
}

export function rankTopN(rows: CollectedVideo[], n: number): CollectedVideo[] {
  return [...rows]
    .sort((a, b) => (b.view_count ?? -1) - (a.view_count ?? -1))
    .slice(0, n);
}
