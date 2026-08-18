/**
 * 빈틈 화면이 쓰는 client-safe 타입.
 *
 * gaps.ts는 server-only라 client 컴포넌트가 타입만 쓰려 해도 import할 수 없다.
 * shared.ts / _db-shared.ts와 같은 갈래다.
 */
export type PendingProposal = { path: string; title: string };
