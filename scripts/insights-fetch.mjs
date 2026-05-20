// 인사이트 영상 자동 수집 — YouTube Data API v3 search.list → Supabase upsert
// 사용 (local): YOUTUBE_API_KEY=... node scripts/insights-fetch.mjs
// 사용 (CI):    GitHub Actions에서 env로 주입 (.env.local 없으면 process.env로 폴백)
// quota: search.list 1회 = 100 unit × 키워드 7개 = 700 unit/일 (일 한도 10000)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// --- env 로드 (.env.local 우선, 없으면 process.env) ---
const envFromFile = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .reduce((acc, l) => {
        const [k, ...v] = l.split("=");
        if (k) acc[k.trim()] = v.join("=").trim();
        return acc;
      }, {})
  : {};

const env = { ...envFromFile, ...process.env };

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY) {
  console.error(
    "Missing required env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / YOUTUBE_API_KEY",
  );
  process.exit(1);
}

// --- 키워드 (schemas.ts와 동일하게 유지 — node에서 ts import 회피) ---
const SEARCH_QUERIES = [
  "바이브코딩",
  "Claude Code",
  "클로드 스킬",
  "AI 환경구축",
  "AI 디자인 활용",
  "AI 개발 환경",
  "AI 활용 업무 적용",
  "자동화",
  "CODEX",
  "하네스",
];

// --- 14일 전 ISO (publishedAfter) — 인기 영상 풀 확보 ---
const PUBLISHED_AFTER_DAYS = 14;
const publishedAfter = new Date(
  Date.now() - PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000,
).toISOString();

// --- 조회수 임계값 — 광고·시도 영상 컷오프 ---
const MIN_VIEW_COUNT = 10_000;

// --- YouTube fetch ---
async function searchVideos(keyword) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    order: "viewCount",
    publishedAfter,
    q: keyword,
    key: YOUTUBE_API_KEY,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube search.list ${keyword} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.items ?? []).map((it) => ({
    video_id: it.id?.videoId,
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

// --- main ---
const collected = new Map();
const errors = [];
let quotaUsed = 0;

for (const q of SEARCH_QUERIES) {
  try {
    const items = await searchVideos(q);
    quotaUsed += 100;
    for (const it of items) {
      if (!it.video_id) continue;
      if (!it.title || !it.channel_title || !it.thumbnail_url) continue;
      if (!collected.has(it.video_id)) collected.set(it.video_id, it);
    }
    console.log(`[${q}] fetched ${items.length}`);
  } catch (e) {
    errors.push({ keyword: q, message: e.message });
    console.error(`[${q}] FAIL`, e.message);
  }
}

const rows = Array.from(collected.values());
console.log(`dedupe → ${rows.length} unique videos (quota used: ~${quotaUsed} unit)`);

if (rows.length === 0) {
  console.log("nothing to upsert.");
  if (errors.length > 0) process.exit(1);
  process.exit(0);
}

// --- videos.list로 full description + 조회수 보강 ---
// part=snippet,statistics — id 필터는 호출당 최대 50개 → 50개씩 batch로 분할.
// (50 초과를 한 번에 보내면 400 "invalid filter parameter")
const descMap = new Map();
const viewMap = new Map();
const allIds = rows.map((r) => r.video_id);
for (let i = 0; i < allIds.length; i += 50) {
  const batchNo = i / 50 + 1;
  const ids = allIds.slice(i, i + 50).join(",");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}&key=${YOUTUBE_API_KEY}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      for (const item of json.items ?? []) {
        const full = (item.snippet?.description ?? "").slice(0, 600) || null;
        if (full) descMap.set(item.id, full);
        const vc = Number(item.statistics?.viewCount);
        if (Number.isFinite(vc) && vc >= 0) viewMap.set(item.id, vc);
      }
      quotaUsed += 1;
    } else {
      const body = await res.text();
      console.error(
        `videos.list HTTP ${res.status} (batch ${batchNo}): ${body.slice(0, 200)} — keep snippet description`,
      );
    }
  } catch (e) {
    console.error(
      `videos.list fetch failed (batch ${batchNo}):`,
      e.message,
      "— keep snippet description",
    );
  }
}
for (const r of rows) {
  const full = descMap.get(r.video_id);
  if (full) r.description = full;
  const vc = viewMap.get(r.video_id);
  if (typeof vc === "number") r.view_count = vc;
}
console.log(
  `videos.list → ${descMap.size} full descriptions, ${viewMap.size} view counts (quota used: ~${quotaUsed} unit)`,
);

// --- 조회수 임계값 컷오프 (광고·시도 영상 제외) ---
// view_count null인 row는 그대로 통과 (videos.list 실패 시 fallback)
const popular = rows.filter(
  (r) => r.view_count == null || r.view_count >= MIN_VIEW_COUNT,
);
const dropped = rows.length - popular.length;
console.log(
  `popularity filter (>= ${MIN_VIEW_COUNT.toLocaleString()} views): kept ${popular.length}, dropped ${dropped}`,
);

// --- 키워드 전체에서 최대 N개만 (view_count 기준 top, null은 후순위) ---
const MAX_UPSERT_PER_RUN = 10;
const ranked = [...popular].sort(
  (a, b) => (b.view_count ?? -1) - (a.view_count ?? -1),
);
const topN = ranked.slice(0, MAX_UPSERT_PER_RUN);
console.log(
  `top-N cutoff: keeping ${topN.length} (max ${MAX_UPSERT_PER_RUN}) — dropped ${popular.length - topN.length} below cutoff`,
);

if (topN.length === 0) {
  console.log("nothing to upsert after top-N cutoff.");
  if (errors.length > 0) process.exit(1);
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("insight_videos")
  .upsert(topN, { onConflict: "video_id", ignoreDuplicates: false })
  .select("video_id");

if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}

console.log(`upserted: ${data?.length ?? 0} rows, errors: ${errors.length}`);

// --- 60일 지난 row cleanup (DB 용량 + UI 정합성) ---
const CLEANUP_DAYS = 60;
const cleanupCutoff = new Date(
  Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000,
).toISOString();
const { data: deleted, error: delErr } = await supabase
  .from("insight_videos")
  .delete()
  .lt("collected_at", cleanupCutoff)
  .select("id");
if (delErr) {
  console.error(`cleanup (>${CLEANUP_DAYS}d) failed:`, delErr.message);
} else {
  console.log(
    `cleanup: deleted ${deleted?.length ?? 0} rows older than ${CLEANUP_DAYS} days`,
  );
}

if (errors.length > 0) {
  console.error("partial errors:", JSON.stringify(errors, null, 2));
  process.exit(1);
}
