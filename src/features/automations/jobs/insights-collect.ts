import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSIGHT_CHANNELS } from "@/features/insight-videos/schemas";
import type { AutomationRunResult } from "../types";

export const MAX_UPSERT_PER_RUN = 10;
export const PUBLISHED_AFTER_DAYS = 30;
export const VIDEOS_LIST_BATCH = 50;
export const CHANNELS_LIST_BATCH = 50;
/** 채널별 최근 업로드 조회 건수 (playlistItems.list 1콜 = 1 unit). */
export const PLAYLIST_FETCH = 20;
export const CLEANUP_DAYS = 60;

export type CollectedVideo = {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
  description: string | null;
  /** 수집 출처 채널명 (insight_videos.keyword 컬럼에 저장). */
  keyword: string;
  view_count?: number;
};

/**
 * Postgres JSON 파싱을 깨뜨리는 무효 문자 제거.
 * - NUL·C0 제어문자(탭/개행/CR 제외): "unsupported Unicode escape sequence"
 * - 짝 없는 서로게이트(깨진 이모지): "invalid input syntax for type json"
 * PostgREST가 upsert 본문을 JSON으로 파싱 후 캐스팅하므로 사전 정제가 필요하다.
 */
export function sanitizeText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1");
}

/** CollectedVideo의 문자열 필드를 정제 (null description은 유지). */
export function sanitizeVideo(v: CollectedVideo): CollectedVideo {
  return {
    ...v,
    title: sanitizeText(v.title),
    channel_title: sanitizeText(v.channel_title),
    thumbnail_url: sanitizeText(v.thumbnail_url),
    keyword: sanitizeText(v.keyword),
    description: v.description == null ? v.description : sanitizeText(v.description),
  };
}

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

/** published_at이 cutoff(ISO) 이후(>=)인 영상만 유지. */
export function filterByPublishedAfter(
  rows: CollectedVideo[],
  cutoffIso: string,
): CollectedVideo[] {
  return rows.filter((r) => r.published_at >= cutoffIso);
}

/** 조회수 내림차순 정렬 후 상위 N개. */
export function rankTopN(rows: CollectedVideo[], n: number): CollectedVideo[] {
  return [...rows]
    .sort((a, b) => (b.view_count ?? -1) - (a.view_count ?? -1))
    .slice(0, n);
}

/**
 * 실행 이력 메시지 — 신규 insert와 기존 갱신을 구분한다.
 * upsert(ignoreDuplicates:false)는 이미 있던 영상도 배치에 포함해 갱신하므로,
 * 배치 크기를 '적재'로 뭉뚱그리면 실제 신규보다 커 보인다(예: 상위 10건 중 신규 4·갱신 6).
 */
export function buildCollectRunMessage(
  newCount: number,
  updatedCount: number,
  cleaned: number,
  errorCount: number,
): string {
  const suffix = errorCount ? ` (${errorCount}건 오류)` : "";
  return `신규 ${newCount}건 · 갱신 ${updatedCount}건 · 정리 ${cleaned}건${suffix}`;
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

// ─── YouTube Data API 응답 타입 ────────────────────────────────
type YtChannelItem = {
  id?: string;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type YtChannelsResponse = { items?: YtChannelItem[] };

type YtPlaylistItem = {
  snippet?: {
    title?: string;
    publishedAt?: string;
    description?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    resourceId?: { videoId?: string };
    videoOwnerChannelTitle?: string;
    channelTitle?: string;
  };
};
type YtPlaylistItemsResponse = { items?: YtPlaylistItem[] };

type YtVideoItem = {
  id?: string;
  snippet?: { description?: string };
  statistics?: { viewCount?: string };
};
type YtVideosResponse = { items?: YtVideoItem[] };

/** channels.list(contentDetails) 응답 → channelId → uploads 플레이리스트 ID 매핑. */
export function extractUploadsPlaylists(
  json: YtChannelsResponse,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const it of json.items ?? []) {
    const id = it.id;
    const uploads = it.contentDetails?.relatedPlaylists?.uploads;
    if (id && uploads) map.set(id, uploads);
  }
  return map;
}

/**
 * playlistItems.list(snippet) 응답 → CollectedVideo[].
 * 비공개("Private video")·삭제("Deleted video")·videoId/썸네일 없는 항목은 제외.
 * keyword 컬럼에는 출처 채널명을 저장한다.
 */
export function mapPlaylistItemsToVideos(
  json: YtPlaylistItemsResponse,
  channelName: string,
): CollectedVideo[] {
  return (json.items ?? []).flatMap((it) => {
    const s = it.snippet;
    const video_id = s?.resourceId?.videoId ?? "";
    const title = s?.title ?? "";
    if (!video_id || !title || title === "Private video" || title === "Deleted video") {
      return [];
    }
    const thumbnail_url =
      s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "";
    if (!thumbnail_url) return [];
    return [
      {
        video_id,
        title,
        channel_title: s?.videoOwnerChannelTitle ?? s?.channelTitle ?? channelName,
        thumbnail_url,
        published_at: s?.publishedAt ?? new Date().toISOString(),
        description: (s?.description ?? "").slice(0, 600) || null,
        keyword: channelName,
      },
    ];
  });
}

/** 채널 ID 목록 → uploads 플레이리스트 매핑 (channels.list 50개씩 batch). */
async function fetchUploadsPlaylists(
  channelIds: string[],
  apiKey: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of batchIds(channelIds, CHANNELS_LIST_BATCH)) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${batch.join(",")}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`channels.list HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as YtChannelsResponse;
    for (const [k, v] of extractUploadsPlaylists(json)) map.set(k, v);
  }
  return map;
}

/** uploads 플레이리스트의 최근 업로드 영상 조회. */
async function fetchPlaylistVideos(
  playlistId: string,
  channelName: string,
  apiKey: string,
): Promise<CollectedVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: String(PLAYLIST_FETCH),
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `playlistItems ${channelName} HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as YtPlaylistItemsResponse;
  return mapPlaylistItemsToVideos(json, channelName);
}

export async function runInsightsCollect(): Promise<AutomationRunResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "YOUTUBE_API_KEY 환경 변수가 없습니다." };
  }

  const publishedAfter = new Date(
    Date.now() - PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const errors: string[] = [];

  // 1) 채널 ID → uploads 플레이리스트
  let uploadsMap: Map<string, string>;
  try {
    uploadsMap = await fetchUploadsPlaylists(
      INSIGHT_CHANNELS.map((c) => c.id),
      apiKey,
    );
  } catch (e) {
    return {
      ok: false,
      message: `채널 조회 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2) 채널별 최근 업로드 수집
  const collected: CollectedVideo[] = [];
  for (const ch of INSIGHT_CHANNELS) {
    const playlistId = uploadsMap.get(ch.id);
    if (!playlistId) {
      errors.push(`${ch.name}: uploads 플레이리스트 없음`);
      continue;
    }
    try {
      const items = await fetchPlaylistVideos(playlistId, ch.name, apiKey);
      collected.push(...items);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // 3) 최근 30일 + 중복 제거 + 차단 제외
  const recent = filterByPublishedAfter(collected, publishedAfter);
  const deduped = dedupeByVideoId(recent);
  const blocked = await getBlockedVideoIds();
  const rows = excludeBlocked(deduped, blocked);
  if (rows.length === 0) {
    return {
      ok: errors.length === 0,
      message: errors.length
        ? `수집 실패: ${errors.length}건`
        : "최근 30일 신규 영상이 없습니다.",
      details: { collected: 0, errors: errors.length },
    };
  }

  // 4) videos.list 50개씩 batch — full description + view_count 보강
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

  // 5) 조회수 높은 순 상위 N (관련성/조회수 임계 필터 없음 — curated 채널)
  //    upsert 직전 무효 유니코드 문자 제거 (Postgres JSON 파싱 실패 방지)
  const topN = rankTopN(enriched, MAX_UPSERT_PER_RUN).map(sanitizeVideo);
  const topNIds = topN.map((v) => v.video_id);

  const supabase = createAdminClient();

  // 신규/갱신 구분 — upsert 직전에 이미 존재하는 video_id를 조회한다.
  // (upsert 후엔 전부 존재하므로 반드시 사전 조회. collected_at은 갱신하지 않아
  //  기존 행은 최초 수집일을 유지 = 메뉴의 날짜별 그룹과 일치.)
  const { data: existingRows, error: existErr } = await supabase
    .from("insight_videos")
    .select("video_id")
    .in("video_id", topNIds);
  if (existErr) {
    return { ok: false, message: `기존 조회 실패: ${existErr.message}` };
  }
  const existingIds = new Set((existingRows ?? []).map((r) => r.video_id));
  const newCount = topNIds.filter((id) => !existingIds.has(id)).length;
  const updatedCount = topNIds.length - newCount;

  const { error } = await supabase
    .from("insight_videos")
    .upsert(topN, { onConflict: "video_id", ignoreDuplicates: false });
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
    message: buildCollectRunMessage(
      newCount,
      updatedCount,
      deleted?.length ?? 0,
      errors.length,
    ),
    details: {
      inserted: newCount,
      updated: updatedCount,
      cleaned: deleted?.length ?? 0,
      errors: errors.length,
    },
  };
}
