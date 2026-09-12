import { CANDIDATE_STATUSES, type CandidateStatus } from "./schemas";

/**
 * 기본으로 보는 칸. 주소에 `scope` 가 없으면 이것이다.
 *
 * 평소에 볼 것은 아직 결정 안 한 후보뿐이고, 숨김·등록됨은 되짚어 볼 때만 연다.
 */
export const DEFAULT_CANDIDATE_SCOPE: CandidateStatus = "pending";

/**
 * 주소의 `scope` → 상태. 모르는 값은 기본으로 떨어진다 — 주소를 잘못 고쳐도
 * 빈 화면이 아니라 평소 화면이 나온다.
 *
 * **칩(클라이언트)과 목록(서버)이 같은 함수를 쓴다.** 각자 판정하면 한쪽 기본값만
 * 바뀌었을 때 칩은 '검토 대기'를 켜두고 목록은 다른 칸을 보여준다.
 */
export function resolveCandidateScope(
  raw: string | null | undefined,
): CandidateStatus {
  return CANDIDATE_STATUSES.find((s) => s === raw) ?? DEFAULT_CANDIDATE_SCOPE;
}
