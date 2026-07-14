import { useState } from "react";
import type { EditFormProps } from "../types";
import { AI_TOOL_OPTIONS, CATEGORY_OPTIONS } from "@/lib/ai-work/constants";

export function AiTipsForm({
  row,
  setRow,
  onSave,
  onCancel,
  currentUserEmail = null,
  currentUserPermission = null,
}: EditFormProps) {
  // 태그 입력은 raw 텍스트를 로컬 보관 — 쉼표를 입력하는 즉시 split/filter로
  // 사라지는 것을 막는다. 다른 항목 선택(row.id 변경) 시에만 재동기화.
  const [tagsText, setTagsText] = useState((row.tags ?? []).join(", "));
  const [prevRowId, setPrevRowId] = useState(row.id);
  if (row.id !== prevRowId) {
    setPrevRowId(row.id);
    setTagsText((row.tags ?? []).join(", "));
  }
  const isAdmin = currentUserPermission === "admin";
  const isOwnAuthor =
    !!currentUserEmail &&
    !!row.authorEmail &&
    row.authorEmail === currentUserEmail;
  const canDelete = isAdmin || isOwnAuthor;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      {row.owner && (
        <div className="block text-xs">
          <span className="mb-1 block text-muted">등록자</span>
          <p className="border border-line-soft bg-washi-raised px-2 py-1 text-ink">
            {row.owner}
            <span className="ml-1 text-2xs text-muted">(본인 자동 입력)</span>
          </p>
        </div>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목 (80자 이내)</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          maxLength={80}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="예: 회의록 5문장 요약 프롬프트"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">AI 도구</span>
          <select
            aria-label="AI 도구"
            value={row.aiTool ?? ""}
            onChange={(e) => setRow({ ...row, aiTool: e.target.value })}
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택…</option>
            {AI_TOOL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <select
            aria-label="카테고리"
            value={row.category ?? ""}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택…</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">요약 (1~3줄, 500자 이내)</span>
        <textarea
          aria-label="요약"
          value={row.summary ?? ""}
          onChange={(e) => setRow({ ...row, summary: e.target.value })}
          rows={3}
          maxLength={500}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="어떤 상황에서 쓰는 팁인지 짧게"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">
          재사용 프롬프트 <span className="text-vermilion">*</span>
        </span>
        <textarea
          aria-label="재사용 프롬프트"
          value={row.reusePrompt ?? ""}
          onChange={(e) => setRow({ ...row, reusePrompt: e.target.value })}
          rows={6}
          required
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="동료가 복사해서 바로 쓸 수 있는 프롬프트 (필수)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">태그 (쉼표 구분)</span>
        <input
          aria-label="태그"
          value={tagsText}
          onChange={(e) => {
            setTagsText(e.target.value);
            setRow({
              ...row,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            });
          }}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="회의록, 주간"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft"
        >
          취소
        </button>
      </div>
      {row.id !== "" && canDelete && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 AI 활용 TIP을 삭제하시겠습니까? 되돌릴 수 없습니다.",
                )
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
