import { useState } from "react";
import type { EditFormProps } from "../types";
import { AI_TOOL_OPTIONS, CATEGORY_OPTIONS } from "@/lib/ai-work/constants";
import { DateInput } from "@/components/common/DateInput";

export function AiWorkForm({
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
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          maxLength={120}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 회의록 요약 자동화"
        />
      </label>
      <fieldset className="block text-xs">
        <legend className="mb-1 block text-muted">작업 기간</legend>
        <div className="grid grid-cols-2 gap-2">
          <DateInput
            aria-label="작업 시작일"
            value={row.workStartDate ?? ""}
            onChange={(e) => setRow({ ...row, workStartDate: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
          <DateInput
            aria-label="작업 종료일"
            value={row.workEndDate ?? ""}
            min={row.workStartDate ?? undefined}
            onChange={(e) => setRow({ ...row, workEndDate: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">AI 도구</span>
          <select
            aria-label="AI 도구"
            value={row.aiTool ?? ""}
            onChange={(e) => setRow({ ...row, aiTool: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
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
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
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
        <span className="mb-1 block text-muted">요약</span>
        <textarea
          aria-label="요약"
          value={row.summary ?? ""}
          onChange={(e) => setRow({ ...row, summary: e.target.value })}
          rows={5}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="무엇을, 왜, 어떤 결과를 얻었는지 (Markdown 가능)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">기능설명</span>
        <textarea
          aria-label="기능설명"
          value={row.featureDesc ?? ""}
          onChange={(e) =>
            setRow({ ...row, featureDesc: e.target.value || null })
          }
          rows={5}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="이 작업/도구가 수행하는 기능을 설명 (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">결과물 링크</span>
        <input
          aria-label="결과물 링크"
          type="url"
          value={row.outputUrl ?? ""}
          onChange={(e) =>
            setRow({ ...row, outputUrl: e.target.value || null })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="https://notion.so/... (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">재사용 프롬프트</span>
        <textarea
          aria-label="재사용 프롬프트"
          value={row.reusePrompt ?? ""}
          onChange={(e) =>
            setRow({ ...row, reusePrompt: e.target.value || null })
          }
          rows={6}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="동료가 복사해서 바로 쓸 수 있는 프롬프트 (선택)"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">절감 시간 (시간)</span>
          <input
            aria-label="절감 시간"
            type="number"
            step="0.1"
            min="0"
            value={row.savedHours ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                savedHours:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="0.5"
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
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="회의록, 주간"
          />
        </label>
      </div>
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
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
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
                  "이 AI 활용 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.",
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
