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
