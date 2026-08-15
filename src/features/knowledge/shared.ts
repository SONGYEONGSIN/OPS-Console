/**
 * 업무 지식망 열람의 **client-safe** 부분 — 타입·분류 순서·순수 함수.
 *
 * Supabase 조회는 queries.ts(server-only)에 있다. client 컴포넌트가 이 파일만
 * import 하도록 갈라둔다 — 안 그러면 server-only 모듈이 클라이언트 번들로 끌려와
 * 빌드가 깨진다(설정 화면 _db-shared.ts와 같은 이유).
 */

/** 목록용 — body를 뺀 가벼운 행. 문서가 늘어도 목록 로딩이 무거워지지 않는다. */
export type KnowledgeDocRow = {
  path: string;
  category: string;
  title: string;
  owner: string | null;
  updated: string | null;
  related: string[];
  missing: string[];
  categoryMismatch: boolean;
};

export type KnowledgeDocFull = KnowledgeDocRow & { body: string };

/**
 * 설계 §3의 분류 순서. 알파벳순으로 두면 '개념 → 플레이북 → 규칙'이라는
 * 읽는 순서가 깨진다.
 * `제안/`은 에이전트 초안 칸이라 열람 목록에 섞지 않는다.
 */
export const CATEGORY_ORDER = [
  "개념",
  "플레이북",
  "규칙",
  "결정",
  "오류사례",
  "엔티티",
  "프로젝트",
] as const;

/** 형식 미비 문서를 모아 보여주는 가상 분류 — 버리는 칸이 아니라 고칠 목록이다. */
export const INCOMPLETE_GROUP = "미분류";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

/** 6개월 넘게 안 고친 문서. updated가 없으면 낡음으로 보지 않는다(누락은 missing이 잡는다). */
export function isStale(updated: string | null, now: Date = new Date()): boolean {
  if (!updated) return false;
  const t = Date.parse(updated);
  return Number.isFinite(t) && now.getTime() - t > SIX_MONTHS_MS;
}

export type KnowledgeGroup = { category: string; docs: KnowledgeDocRow[] };

/**
 * 분류별로 묶는다 — 설계 순서 우선, 설계에 없는 폴더는 버리지 않고 뒤에 붙인다.
 * 형식 미비 문서는 원래 분류에 남긴 채 `미분류`에도 함께 넣는다.
 */
export function groupByCategory(rows: KnowledgeDocRow[]): KnowledgeGroup[] {
  const byCat = new Map<string, KnowledgeDocRow[]>();
  for (const r of rows) {
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }

  const known = CATEGORY_ORDER.filter((c) => byCat.has(c));
  const extra = [...byCat.keys()]
    .filter((c) => !CATEGORY_ORDER.includes(c as (typeof CATEGORY_ORDER)[number]))
    .sort((a, b) => a.localeCompare(b, "ko"));

  const groups: KnowledgeGroup[] = [...known, ...extra].map((category) => ({
    category,
    docs: (byCat.get(category) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title, "ko"),
    ),
  }));

  const incomplete = rows
    .filter((r) => r.missing.length > 0 || r.categoryMismatch)
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
  if (incomplete.length) {
    groups.push({ category: INCOMPLETE_GROUP, docs: incomplete });
  }
  return groups;
}
