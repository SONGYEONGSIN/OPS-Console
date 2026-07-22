import type { ItemStatus } from "@/features/checklist/schemas";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  todo: "작업전",
  na: "해당없음",
};

// 선택된 상태 칩 스타일 (design-tokens 색). 완료=sage(초록)·진행중=amber·작업전=ink·해당없음=회색.
export const STATUS_STYLE: Record<ItemStatus, string> = {
  done: "border-sage bg-sage/10 text-sage",
  in_progress: "border-amber bg-amber/10 text-amber",
  todo: "border-ink bg-ink/5 text-ink",
  na: "border-line bg-line-soft text-muted",
};
