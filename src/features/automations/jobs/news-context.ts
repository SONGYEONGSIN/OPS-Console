/**
 * 동일 맥락(같은 사건) 뉴스 군집화 — 제목 토큰 기반 휴리스틱.
 *
 * 배경: 같은 사건(예: "광양보건대 파산·폐교")이 매체·날짜별로 제목만 다른 기사
 * 수십 건으로 잡힌다. link/title 완전일치 dedup으로는 못 거른다. 운영부 cron은
 * 서버리스(LLM 불가)라 임베딩 없이 토큰 휴리스틱으로 군집화하고 군집별 최신 1건만 남긴다.
 *
 * 한국어 특성상 조사가 붙어("파산이"·"폐교는") 단순 일치가 약하므로,
 *  - 조사 제거 정규화
 *  - 토큰 접두 매칭(사립대 ⊂ 사립대학구조개선법)
 *  - 긴 고유명사(길이 ≥ 5: "광양보건대") 공유 = 강한 동일-맥락 신호
 * 를 조합한다. 오병합(서로 다른 기사를 합침)보다 미병합(못 합침)이 안전하므로
 * 임계값은 보수적으로 둔다.
 */

// 도메인 범용어 — 거의 모든 제목에 등장하므로 맥락 식별에 무의미.
const STOPWORDS = new Set([
  "대학",
  "대학교",
  "뉴스",
  "단독",
  "속보",
  "종합",
  "칼럼",
  "시사칼럼",
  "기자수첩",
  "특파원",
  "사설",
  "현장",
  "위기",
  "관련",
  "위한",
  "위해",
  "대한",
  "오늘",
  "지방",
  "전국",
]);

// 길이 내림차순 — 긴 조사부터 떼어야 "으로"가 "로"보다 먼저 매칭된다.
const JOSA = [
  "으로서",
  "으로써",
  "에서는",
  "에게서",
  "이라고",
  "라고",
  "이라",
  "으로",
  "에서",
  "에게",
  "까지",
  "부터",
  "처럼",
  "보다",
  "마저",
  "조차",
  "이나",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "에",
  "도",
  "로",
  "와",
  "과",
  "만",
  "나",
];

function stripJosa(token: string): string {
  for (const j of JOSA) {
    if (token.endsWith(j) && token.length - j.length >= 2) {
      return token.slice(0, token.length - j.length);
    }
  }
  return token;
}

/** 제목 → 의미 토큰 집합(중복 제거). source가 주어지면 ' - 출처' 접미사를 먼저 제거. */
export function tokenizeTitle(title: string, source?: string | null): string[] {
  let t = title;
  if (source && t.endsWith(` - ${source}`)) {
    t = t.slice(0, t.length - ` - ${source}`.length);
  }
  // 마지막 ' - 출처' / ' > 뉴스' 류 꼬리 제거(구글 뉴스 표기)
  t = t.replace(/\s*[-–—>]\s*[^\s-–—>]+(?:\.[a-z]{2,})?\s*$/i, "");
  const cleaned = t
    .replace(/[\[(（【][^\])）】]*[\])）】]/g, " ") // 대괄호 태그 내용 제거
    .replace(/[^가-힣a-zA-Z0-9]+/g, " ") // 그 외 기호 → 공백
    .toLowerCase();

  const set = new Set<string>();
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue;
    if (/^\d+$/.test(raw)) continue;
    const tok = stripJosa(raw);
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    set.add(tok);
  }
  return Array.from(set);
}

// 두 토큰의 공통 접두 길이(접두 포함 관계일 때만, 아니면 0).
function commonPrefixLen(a: string, b: string): number {
  if (a === b) return a.length;
  if (a.startsWith(b)) return b.length;
  if (b.startsWith(a)) return a.length;
  return 0;
}

// 두 경로 중 하나면 동일 맥락(오병합보다 미병합이 안전하도록 보수적):
//  경로 A — 강한 고유명사 앵커: 공통 접두 길이 ≥5 토큰(예: "광양보건대") 공유 +
//           공유 토큰 ≥2. 제목이 길어 겹침 비율이 낮아도 같은 사건으로 본다.
//  경로 B — 일반: 구별 토큰(공통 접두 길이 ≥4) 공유 + 공유 ≥2 + 겹침 비율 ≥0.5.
//           "정원"+"감축" 같은 범용 2글자 정책어만 겹치는 서로 다른 사건을 막는다.
const STRONG_ANCHOR_LEN = 5;
const DISTINCT_ANCHOR_LEN = 4;
const MIN_SHARED = 2;
const GENERIC_OVERLAP = 0.5;

/** 두 토큰 집합이 같은 맥락인지 판정. */
export function similarContext(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  let shared = 0;
  let hasStrong = false;
  let hasDistinct = false;
  for (const x of a) {
    let best = 0;
    for (const y of b) best = Math.max(best, commonPrefixLen(x, y));
    if (best >= 2) {
      shared++;
      if (best >= STRONG_ANCHOR_LEN) hasStrong = true;
      if (best >= DISTINCT_ANCHOR_LEN) hasDistinct = true;
    }
  }
  if (shared < MIN_SHARED) return false;
  if (hasStrong) return true; // 경로 A
  const overlap = shared / Math.min(a.length, b.length);
  return hasDistinct && overlap >= GENERIC_OVERLAP; // 경로 B
}

type ContextRow = { title: string; published_at?: string | null };

// published_at 내림차순(없으면 후순위). 동률·null은 입력 순서 보존(stable).
function byNewest<T extends ContextRow>(rows: T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((p, q) => {
      const pa = p.row.published_at ?? "";
      const qa = q.row.published_at ?? "";
      if (pa !== qa) return qa.localeCompare(pa); // desc
      return p.i - q.i;
    })
    .map((x) => x.row);
}

/**
 * 동일 맥락 군집별 최신 1건만 남긴다(나머지 제거). 입력 배열은 변형하지 않는다.
 * 최신순 greedy — 먼저 등장(=최신)한 행이 군집 대표가 되고, 이후 같은 맥락은 버린다.
 */
export function dedupeByContext<T extends ContextRow>(rows: T[]): T[] {
  const reps: { tokens: string[]; row: T }[] = [];
  for (const row of byNewest(rows)) {
    const tokens = tokenizeTitle(row.title);
    const hit = reps.find((r) => similarContext(tokens, r.tokens));
    if (!hit) reps.push({ tokens, row });
  }
  return reps.map((r) => r.row);
}
