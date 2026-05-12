import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const POST_FEEDBACK_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "요청" },
  { value: "review", label: "확인" },
  { value: "active", label: "처리중" },
  { value: "approved", label: "처리완료" },
];

export const POST_NOTICE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "approved", label: "종료" },
];

export function blankPostRow(
  variant: "post-feedback" | "post-notice",
): ListRow {
  return {
    id: "",
    name: "",
    // feedback: 등록 시 '요청', notice: '활성'으로 시작
    status: variant === "post-feedback" ? "urgent" : "active",
    owner: "",
    body: "",
    author: "",
  };
}
