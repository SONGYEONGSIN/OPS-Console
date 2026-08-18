import { join, resolve, sep } from "node:path";

/**
 * 에이전트가 볼트에 초안을 쓰는 경로를 만든다. **`제안/` 밖으로는 못 나간다.**
 *
 * 볼트 설계 §7 — 에이전트가 쓴 것은 사람이 승인해 옮기기 전까지 본 위치에 닿으면
 * 안 된다. §8의 실측(에이전트가 쓴 10건 중 3건이 오류)이 그 근거다.
 *
 * 순수 함수로 둔 이유: 폴러 안에 묻으면 탈출 시도를 테스트할 수 없다.
 */

/** 에이전트 초안이 들어가는 유일한 디렉토리. */
export const PROPOSAL_DIR = "제안";

/** 경로를 만들 수 있는 것 — 조용히 지우지 않고 **던진다**. */
const PATH_LIKE = /[/\\]|\.\./;
/** Windows에서 파일명에 못 쓰는 문자. 경로를 만들지는 못하므로 지운다. */
const RESERVED = /[:*?"<>|]/g;

/**
 * 제목 → 파일명.
 *
 * 경로 구분자나 `..`가 있으면 **던진다.** 조용히 뭉개면(`a/b` → `ab.md`) 탈출
 * 시도가 아무 데도 안 남는다 — 프로젝트 규칙(조용한 폴백 금지)에 어긋난다.
 * 예약 문자는 경로를 만들 수 없으므로 지우기만 한다.
 */
export function proposalFileName(title) {
  if (PATH_LIKE.test(title)) {
    throw new Error(`제목에 경로가 들어 있습니다: ${title}`);
  }
  const cleaned = title.replace(RESERVED, "").trim();
  if (!cleaned) {
    throw new Error("제목이 파일명으로 쓸 수 없습니다");
  }
  return `${cleaned}.md`;
}

/**
 * 볼트 루트 + 제목 → `<볼트>/제안/<파일명>.md` 절대경로.
 *
 * 정규화(1차)만 믿지 않고 **만들어진 경로가 실제로 `제안/` 안인지 다시 본다**(2차).
 * `제안-x/` 같은 접두 위장을 막으려면 구분자까지 붙여 비교해야 한다.
 */
export function resolveProposalPath(vaultRoot, title) {
  if (!vaultRoot.trim()) {
    throw new Error("볼트 경로가 설정되지 않았습니다");
  }
  const dir = resolve(vaultRoot, PROPOSAL_DIR);
  const full = resolve(join(dir, proposalFileName(title)));
  if (!full.startsWith(dir + sep)) {
    throw new Error(`제안 폴더를 벗어납니다: ${title}`);
  }
  return full;
}

/** 볼트의 실제 분류 폴더. 여기 없는 값은 파일이 엉뚱한 데 생긴다. */
export const VAULT_CATEGORIES = [
  "개념",
  "플레이북",
  "규칙",
  "결정",
  "오류사례",
  "엔티티",
  "프로젝트",
];

/**
 * 운영 데이터 출처 → 볼트 분류. **사용자에게 묻지 않는다.**
 *
 * 운영자가 8칸을 외울 이유가 없고, 모델이 매번 고르면 같은 종류가 흩어진다.
 *
 * 인수인계가 엔티티인 근거(2026-08-18 판정): "대상이 바뀌면 문서가 바뀌나"로 가른다.
 * 부산대를 빼면 그 내용이 성립하지 않으므로 엔티티다. 플레이북은 대상 무관 절차다
 * — 인수인계를 플레이북에 넣기 시작하면 53건이 들어가 그 칸이 덤프장이 된다.
 */
export const CATEGORY_BY_DOMAIN = {
  handover: "엔티티",
  incident: "오류사례",
  service: "엔티티",
  contact: "엔티티",
  backup: "플레이북",
  "ai-tip": "개념",
  knowledge: "개념",
};

/**
 * 최종 분류를 정한다. 출처를 알면 매핑이 이기고, 모르면 모델이 고른 값을 쓴다.
 * 어느 쪽도 유효하지 않으면 던진다 — 분류 없이 파일을 만들지 않는다.
 */
export function resolveProposalCategory(sourceDomain, modelCategory) {
  if (sourceDomain) {
    const mapped = CATEGORY_BY_DOMAIN[sourceDomain];
    if (!mapped) {
      throw new Error(`모르는 출처입니다: ${sourceDomain}`);
    }
    return mapped;
  }
  if (!modelCategory || !VAULT_CATEGORIES.includes(modelCategory)) {
    throw new Error(`볼트에 없는 분류입니다: ${modelCategory || "(없음)"}`);
  }
  return modelCategory;
}

/**
 * 분류를 누가 정했나 — 문서 frontmatter에 남긴다.
 *
 * "운영자가 직접 10건을 쓴다"는 0단계 조건은 안 일어난다. 앞으로도 에이전트가 쓴다.
 * 그러면 **8칸이 실제 지식을 담는지** 확인할 길이 사라지므로, 사람이 고른 것과
 * 시스템이 정한 것을 구분해 남긴다. 이게 쌓여야 판정 건수를 셀 수 있다.
 */
export function classifiedBy(sourceDomain) {
  return sourceDomain ? "시스템" : "사람";
}
