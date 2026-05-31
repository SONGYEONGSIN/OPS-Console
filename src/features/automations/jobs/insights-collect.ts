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

/** 제목에 한글(완성형 음절)이 포함되어 있는지. 국내 영상 판별 휴리스틱. */
export function hasKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

/**
 * 국내 영상만 유지 — 제목에 한글이 없는 영상 제외.
 * regionCode/relevanceLanguage는 우선순위 힌트일 뿐 외국 영상을 제외하지 않으므로,
 * 제목 한글 여부로 실제 필터링한다.
 */
export function filterKoreanTitles(rows: CollectedVideo[]): CollectedVideo[] {
  return rows.filter((r) => hasKorean(r.title));
}

/** 차단 목록(insight_video_blocklist)에 등록된 video_id를 제외 — 삭제된 영상 재수집 방지. */
export function excludeBlocked(
  rows: CollectedVideo[],
  blocked: Set<string>,
): CollectedVideo[] {
  if (blocked.size === 0) return rows;
  return rows.filter((r) => !blocked.has(r.video_id));
}

/** insight_video_blocklist의 video_id 집합. 조회 실패 시 빈 집합(수집은 계속). */
async function getBlockedVideoIds(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("insight_video_blocklist")
    .select("video_id");
  if (error) {
    console.error("[insights-collect] blocklist fetch fail:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.video_id as string));
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

/**
 * search.list 쿼리 파라미터. 국내 우선 — regionCode=KR + relevanceLanguage=ko로
 * 한국 지역/한국어 관련성이 높은 영상을 우선 노출(하드 필터 아님).
 */
export function buildSearchParams(
  keyword: string,
  publishedAfter: string,
  apiKey: string,
): URLSearchParams {
  return new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    order: "viewCount",
    regionCode: "KR",
    relevanceLanguage: "ko",
    publishedAfter,
    q: keyword,
    key: apiKey,
  });
}

async function searchVideos(
  keyword: string,
  apiKey: string,
  publishedAfter: string,
): Promise<CollectedVideo[]> {
  const params = buildSearchParams(keyword, publishedAfter, apiKey);
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

  const deduped = dedupeByVideoId(collected);
  // 국내 영상만 — 제목에 한글 없는 외국 영상 제외(regionCode는 우선순위 힌트일 뿐 필터 아님).
  const korean = filterKoreanTitles(deduped);
  // 삭제(blocklist 등록)된 영상은 재수집하지 않는다. videos.list 보강 전에 걸러 quota도 절약.
  const blocked = await getBlockedVideoIds();
  const rows = excludeBlocked(korean, blocked);
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

  const errorSuffix = () => (errors.length ? ` (${errors.length}건 오류)` : "");

  const topN = rankTopN(filterPopular(enriched, MIN_VIEW_COUNT), MAX_UPSERT_PER_RUN);
  // 주의: 적재 0건이면 DB write가 없어 collected_at이 갱신되지 않는다.
  // 쿨다운은 max(collected_at) 기반이므로 이 경로에서는 쿨다운이 리셋되지 않는다 (의도된 트레이드오프).
  if (topN.length === 0) {
    return {
      ok: true,
      message: `임계값을 넘는 신규 영상이 없습니다.${errorSuffix()}`,
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
    message: `${data?.length ?? 0}건 적재, ${deleted?.length ?? 0}건 정리${errorSuffix()}`,
    details: {
      upserted: data?.length ?? 0,
      cleaned: deleted?.length ?? 0,
      errors: errors.length,
    },
  };
}
