import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCH_QUERIES } from "@/features/insight-videos/schemas";
import type { AutomationRunResult } from "../types";

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

type YtSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    publishedAt?: string;
    description?: string;
  };
};
type YtSearchResponse = { items?: YtSearchItem[] };
type YtVideoItem = {
  id?: string;
  snippet?: { description?: string };
  statistics?: { viewCount?: string };
};
type YtVideosResponse = { items?: YtVideoItem[] };

async function searchVideos(
  keyword: string,
  apiKey: string,
  publishedAfter: string,
): Promise<CollectedVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    order: "viewCount",
    publishedAfter,
    q: keyword,
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`search.list ${keyword} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as YtSearchResponse;
  return (json.items ?? []).map((it) => ({
    video_id: it.id?.videoId ?? "",
    title: it.snippet?.title ?? "",
    channel_title: it.snippet?.channelTitle ?? "",
    thumbnail_url:
      it.snippet?.thumbnails?.medium?.url ??
      it.snippet?.thumbnails?.default?.url ??
      "",
    published_at: it.snippet?.publishedAt ?? new Date().toISOString(),
    description: (it.snippet?.description ?? "").slice(0, 600) || null,
    keyword,
  }));
}

export async function runInsightsCollect(): Promise<AutomationRunResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "YOUTUBE_API_KEY 환경 변수가 없습니다." };
  }

  const publishedAfter = new Date(
    Date.now() - PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const collected: CollectedVideo[] = [];
  const errors: string[] = [];
  for (const q of SEARCH_QUERIES) {
    try {
      const items = await searchVideos(q, apiKey, publishedAfter);
      for (const it of items) {
        if (!it.video_id || !it.title || !it.channel_title || !it.thumbnail_url) continue;
        collected.push(it);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const rows = dedupeByVideoId(collected);
  if (rows.length === 0) {
    return {
      ok: errors.length === 0,
      message: errors.length ? `수집 실패: ${errors.length}건` : "수집된 영상이 없습니다.",
      details: { collected: 0, errors: errors.length },
    };
  }

  // videos.list 50개씩 batch — full description + view_count 보강
  const idBatches = batchIds(rows.map((r) => r.video_id), VIDEOS_LIST_BATCH);
  const descMap = new Map<string, string>();
  const viewMap = new Map<string, number>();
  for (const batch of idBatches) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batch.join(",")}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        errors.push(`videos.list HTTP ${res.status}: ${body.slice(0, 200)}`);
        continue;
      }
      const json = (await res.json()) as YtVideosResponse;
      for (const item of json.items ?? []) {
        if (!item.id) continue;
        const full = (item.snippet?.description ?? "").slice(0, 600);
        if (full) descMap.set(item.id, full);
        const vc = Number(item.statistics?.viewCount);
        if (Number.isFinite(vc) && vc >= 0) viewMap.set(item.id, vc);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const enriched: CollectedVideo[] = rows.map((r) => ({
    ...r,
    description: descMap.get(r.video_id) ?? r.description,
    view_count: viewMap.get(r.video_id) ?? r.view_count,
  }));

  const topN = rankTopN(filterPopular(enriched, MIN_VIEW_COUNT), MAX_UPSERT_PER_RUN);
  if (topN.length === 0) {
    return {
      ok: true,
      message: "임계값을 넘는 신규 영상이 없습니다.",
      details: { collected: rows.length, upserted: 0, errors: errors.length },
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("insight_videos")
    .upsert(topN, { onConflict: "video_id", ignoreDuplicates: false })
    .select("video_id");
  if (error) {
    return { ok: false, message: `upsert 실패: ${error.message}` };
  }

  const cleanupCutoff = new Date(
    Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: deleted, error: cleanupError } = await supabase
    .from("insight_videos")
    .delete()
    .lt("collected_at", cleanupCutoff)
    .select("id");
  if (cleanupError) {
    errors.push(`cleanup 실패: ${cleanupError.message}`);
  }

  return {
    ok: true,
    message: `${data?.length ?? 0}건 적재, ${deleted?.length ?? 0}건 정리`,
    details: {
      upserted: data?.length ?? 0,
      cleaned: deleted?.length ?? 0,
      errors: errors.length,
    },
  };
}
