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
  "AI 코딩",
  "Cursor 사용법",
  "Claude Code",
  "Lovable v0",
  "AI 디자인 도구",
  "AI 개발 환경",
];

// --- 7일 전 ISO (publishedAfter) ---
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

// --- YouTube fetch ---
async function searchVideos(keyword) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "3",
    order: "relevance",
    publishedAfter: sevenDaysAgo,
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
    description: (it.snippet?.description ?? "").slice(0, 200) || null,
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("insight_videos")
  .upsert(rows, { onConflict: "video_id", ignoreDuplicates: false })
  .select("video_id");

if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}

console.log(`upserted: ${data?.length ?? 0} rows, errors: ${errors.length}`);
if (errors.length > 0) {
  console.error("partial errors:", JSON.stringify(errors, null, 2));
  process.exit(1);
}
