/**
 * '파일로 초안 만들기'가 client 와 나눠 쓰는 것.
 *
 * `file-draft-actions.ts` 는 "use server" 라 client 컴포넌트가 상수만 쓰려 해도
 * 가져올 수 없다. shared.ts / gaps-types.ts 와 같은 갈래다.
 */

/**
 * 이 화면에서 만든 요청의 표식.
 *
 * 링크·파일·직접 입력 **어느 칸으로 왔든 같아야 한다** — 화면이 이걸로 진행
 * 중이던 요청을 찾아 이어받는다. 탭이 URL 이라 다른 탭에 다녀오면 컴포넌트가
 * 죽는데, 그때 답이 사라지면 되묻기를 못 보는 문제가 그대로 재발한다.
 */
export const FILE_DRAFT_CONTEXT = "지식망 — 파일로 초안";

/** 초안을 만들 재료를 어디서 받는가. */
export type DraftSource = "link" | "file" | "text";
