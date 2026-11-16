// 수신자 경고 종류·문구 — 클라이언트 컴포넌트가 값으로 쓴다. import 를 두지 않는다
// (roster.ts 는 canViewMenu → server-only 로 이어져 클라이언트가 값 import 하면 next build 가 깨진다).

export type RecipientWarning = "not-operator" | "inactive" | "no-menu";

export const RECIPIENT_WARNING_LABEL: Record<RecipientWarning, string> = {
  "not-operator": "운영자 명단에 없음",
  inactive: "비활성 계정",
  "no-menu": "메뉴 권한 없음",
};
