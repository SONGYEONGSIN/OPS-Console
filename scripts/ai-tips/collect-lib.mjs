// AI TIP 수집 순수 로직 — GitHub/claude/서버를 부르지 않는다.
// 호출부(collect-local.mjs)와 분리해 단위 테스트가 가능하게 둔다.

/** 검색할 GitHub 토픽. 몇 회차 돌려보고 조정한다. */
export const TOPICS = [
  "automation",
  "ai-agent",
  "llm",
  "workflow-automation",
  "mcp",
  "rpa",
];

export const MIN_STARS = 200;
export const CREATED_WITHIN_DAYS = 90;
/** 회차당 처리 건수 — claude 호출이 리포당 1회라 시간·비용이 여기서 정해진다. */
export const MAX_PER_RUN = 5;

const AI_TOOLS = [
  "claude",
  "chatgpt",
  "gemini",
  "cursor",
  "copilot",
  "notion_ai",
  "etc",
];
const CATEGORIES = [
  "code",
  "doc",
  "analysis",
  "design",
  "translation",
  "meeting",
  "automation",
  "productivity",
  "devtool",
  "etc",
];

/** 기준 시각에서 days일 전 날짜를 'YYYY-MM-DD'로. */
export function createdAfterDate(now, days) {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function buildSearchQuery(topic, { minStars, createdAfter }) {
  return `topic:${topic} stars:>=${minStars} created:>${createdAfter}`;
}

/**
 * 검색 결과에서 새 리포만 limit개 고른다.
 * seenNames에는 pending뿐 아니라 promoted·hidden도 들어온다 —
 * 한 번 거른 리포가 다시 올라오면 거르는 의미가 없다.
 */
export function pickNewRepos(items, seenNames, limit) {
  const out = [];
  const taken = new Set();
  for (const it of items) {
    const name = it.full_name;
    if (!name || seenNames.has(name) || taken.has(name)) continue;
    taken.add(name);
    out.push({
      repo_full_name: name,
      repo_url: it.html_url,
      stars: it.stargazers_count ?? 0,
      repo_description: it.description ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function buildTipPrompt(repo, readme) {
  return [
    "다음 GitHub 리포지토리를 사내 운영팀에 공유할 'AI 활용 TIP'으로 정리해라.",
    "",
    `리포: ${repo.repo_full_name}`,
    `설명: ${repo.repo_description ?? "(없음)"}`,
    "",
    "README 발췌:",
    readme || "(README 없음)",
    "",
    "아래 JSON만 출력해라. 다른 말은 붙이지 마라.",
    "{",
    '  "title": "80자 이내 한국어 제목",',
    '  "summary_md": "500자 이내 한국어 요약 — 무엇을 하는 도구이고 우리 업무에 어떻게 쓸 수 있는지",',
    '  "reuse_prompt": "동료가 복사해서 바로 쓸 수 있는 한국어 프롬프트",',
    '  "tags": ["태그", "2~4개"],',
    `  "ai_tool": "${AI_TOOLS.join(" | ")}",`,
    `  "category": "${CATEGORIES.join(" | ")}"`,
    "}",
  ].join("\n");
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * claude 출력 → 초안 필드. 파싱 실패나 필수 필드 누락이면 null을 준다.
 * null은 '초안 없이 리포 정보만 저장하라'는 신호다 — 수집 자체를 버리지 않는다.
 */
export function parseTipDraft(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!obj?.title || !obj?.summary_md || !obj?.reuse_prompt) return null;
  return {
    draft_title: String(obj.title).slice(0, 80),
    draft_summary_md: String(obj.summary_md).slice(0, 500),
    draft_reuse_prompt: String(obj.reuse_prompt),
    draft_tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    draft_ai_tool: pick(obj.ai_tool, AI_TOOLS, "etc"),
    draft_category: pick(obj.category, CATEGORIES, "automation"),
  };
}
