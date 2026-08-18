/**
 * 빈틈 화면이 쓰는 client-safe 타입.
 *
 * gaps.ts는 server-only라 client 컴포넌트가 타입만 쓰려 해도 import할 수 없다.
 * shared.ts / _db-shared.ts와 같은 갈래다.
 */
export type PendingProposal = { path: string; title: string };

/**
 * 빈틈 화면의 '초안 요청'이 만든 질문임을 알아보는 표식.
 *
 * 서버가 이 문구로 그 경로를 알아채 "거절하더라도 빈틈을 새로 만들지 마라"를
 * 프롬프트에 붙인다. **문구를 만드는 쪽과 알아보는 쪽이 같은 상수를 봐야** 한 곳만
 * 고쳐서 조용히 깨지는 일이 없다.
 */
export const GAP_DRAFT_MARKER = "를 업무 지식망에 넣을 문서 초안으로 만들어 주세요";
