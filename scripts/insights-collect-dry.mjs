#!/usr/bin/env node
// 인사이트 YouTube 수집 DRY-RUN — DB 기록 없이 무엇이 수집될지 확인.
//   node scripts/insights-collect-dry.mjs
// 실 YouTube Data API 호출(quota 소모). insight_videos 테이블에 쓰지 않음.
//
// 주의: SEARCH_QUERIES / AI_RELEVANCE_TERMS 는 아래 TS 소스를 미러링한 사본이다.
//   - src/features/insight-videos/schemas.ts (SEARCH_QUERIES)
//   - src/features/automations/jobs/insights-collect.ts (AI_RELEVANCE_TERMS 등)
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY 환경 변수가 없습니다 (.env.local).");
  process.exit(1);
}

const SEARCH_QUERIES = [
  "바이브코딩",
  "Claude Code",
  "클로드 스킬",
  "AI 환경구축",
  "AI 디자인 활용",
  "AI 개발 환경",
  "AI 활용 업무 적용",
  "AI 업무 자동화",
  "OpenAI Codex",
  "AI 코딩 에이전트",
];

const AI_RELEVANCE_TERMS = [
  "ai", "인공지능", "에이전트", "agent", "llm", "gpt", "chatgpt", "챗gpt",
  "claude", "클로드", "코딩", "coding", "개발자", "프로그래밍", "자동화",
  "codex", "코덱스", "바이브코딩", "바이브 코딩", "프롬프트", "prompt",
  "cursor", "커서", "gemini", "제미나이", "openai", "오픈ai", "anthropic",
  "copilot", "코파일럿", "mcp", "claude code", "클로드코드",
];

const MIN_VIEW_COUNT = 10_000;
const PUBLISHED_AFTER_DAYS = 14;
const hasKorean = (t) => /[가-힣]/.test(t);
const isAiRelevant = (v) => {
  const hay = `${v.title} ${v.description ?? ""}`.toLowerCase();
  return AI_RELEVANCE_TERMS.some((t) => hay.includes(t));
};

const publishedAfter = new Date(
  Date.now() - PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000,
).toISOString();

async function searchVideos(keyword) {
  const params = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "10", order: "viewCount",
    regionCode: "KR", relevanceLanguage: "ko", publishedAfter, q: keyword, key: API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`search ${keyword} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  return (json.items ?? []).map((it) => ({
    video_id: it.id?.videoId ?? "",
    title: it.snippet?.title ?? "",
    channel_title: it.snippet?.channelTitle ?? "",
    description: it.snippet?.description ?? "",
    keyword,
  }));
}

async function enrich(ids) {
  const descMap = new Map(), viewMap = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batch.join(",")}&key=${API_KEY}`,
    );
    if (!res.ok) continue;
    const json = await res.json();
    for (const it of json.items ?? []) {
      if (!it.id) continue;
      descMap.set(it.id, (it.snippet?.description ?? "").slice(0, 600));
      const vc = Number(it.statistics?.viewCount);
      if (Number.isFinite(vc)) viewMap.set(it.id, vc);
    }
  }
  return { descMap, viewMap };
}

const run = async () => {
  const collected = [];
  for (const q of SEARCH_QUERIES) {
    try {
      const items = await searchVideos(q);
      const ok = items.filter((it) => it.video_id && it.title && it.channel_title);
      collected.push(...ok);
      console.log(`  검색 "${q}": ${ok.length}건`);
    } catch (e) {
      console.log(`  검색 "${q}": 오류 ${e.message}`);
    }
  }

  const seen = new Set();
  const deduped = collected.filter((v) => !seen.has(v.video_id) && seen.add(v.video_id));
  const korean = deduped.filter((v) => hasKorean(v.title));
  const { descMap, viewMap } = await enrich(korean.map((v) => v.video_id));
  const enriched = korean.map((v) => ({
    ...v,
    description: descMap.get(v.video_id) ?? v.description,
    view_count: viewMap.get(v.video_id),
  }));

  const relevant = enriched.filter(isAiRelevant);
  const excluded = enriched.filter((v) => !isAiRelevant(v));
  const popular = relevant.filter((v) => v.view_count == null || v.view_count >= MIN_VIEW_COUNT);
  const topN = [...popular].sort((a, b) => (b.view_count ?? -1) - (a.view_count ?? -1)).slice(0, 10);

  const fmt = (v) => `      [${(v.view_count ?? 0).toLocaleString()}뷰] ${v.title}  ·(${v.keyword})`;
  console.log(`\n수집 ${collected.length} → 중복제거 ${deduped.length} → 한글제목 ${korean.length}`);
  console.log(`\n❌ AI 무관으로 제외 (${excluded.length}건):`);
  excluded.forEach((v) => console.log(`      ${v.title}  ·(${v.keyword})`));
  console.log(`\n✅ AI 관련 + 조회수 ${MIN_VIEW_COUNT.toLocaleString()}↑ → 최종 적재 대상 (${topN.length}건):`);
  topN.forEach((v) => console.log(fmt(v)));
  console.log("\n(DRY-RUN — DB 기록 없음)");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
