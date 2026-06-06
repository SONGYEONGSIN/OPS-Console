"use client";

import { HANDOVER_CHECKLIST_MAX } from "@/features/handover/schemas";

export type ChecklistItem = { id: string; text: string; done: boolean };

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * 계약서류 체크리스트 — 인수인계 '계약자료'. 편집(EditForm)·읽기(View) 겸용.
 * 헤더는 구분선 밖(위), 항목 + children(메모)은 구분선 안에 묶는다.
 * 체크해도 취소선을 긋지 않는다(서류는 받아야 할 항목이라 취소선 부적합).
 */
export function ContractChecklist({
  items,
  onChange,
  readOnly = false,
  label = "계약서류",
  embedded = false,
  children,
}: {
  items: ChecklistItem[];
  onChange?: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
  /** 헤더 라벨 (계약서류 / 제출서류 등) */
  label?: string;
  /** 아코디언 내부 — 자체 제목 라벨을 숨기고 카운트만 표시. */
  embedded?: boolean;
  /** 구분선 안에 함께 묶을 내용(메모 등) */
  children?: React.ReactNode;
}) {
  const received = items.filter((i) => i.done).length;
  const canAdd = items.length < HANDOVER_CHECKLIST_MAX;

  return (
    <div className="space-y-1.5 text-xs">
      {/* 헤더 — 구분선 밖(위) */}
      <div className="flex items-center justify-between">
        <span className="text-muted">
          {!embedded && (
            <span className="font-bold text-ink-soft">{label} </span>
          )}
          현재 ({items.length}/{HANDOVER_CHECKLIST_MAX})
          {items.length > 0 && (
            <span className="ml-1 text-faint">· 완료 {received}/{items.length}</span>
          )}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              if (canAdd && onChange)
                onChange([...items, { id: newId(), text: "", done: false }]);
            }}
            disabled={!canAdd}
            className="cursor-pointer border-none bg-transparent p-0 text-2xs text-vermilion hover:text-vermilion-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            + 항목 추가
          </button>
        )}
      </div>

      {/* 항목 + 메모(children) — 임베드(아코디언) 시 외곽선 없이 */}
      <div
        className={
          embedded ? "space-y-2 pt-1" : "space-y-2 border-y border-line-soft py-3"
        }
      >
        {items.length === 0 ? (
          <p className="border border-dashed border-line-soft bg-cream px-2 py-2 text-2xs text-muted">
            {readOnly
              ? `등록된 ${label} 항목이 없습니다.`
              : `필요한 ${label} 항목을 추가하세요.`}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`항목 ${idx + 1} 완료`}
                  checked={item.done}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange?.(
                      items.map((it, i) =>
                        i === idx ? { ...it, done: e.target.checked } : it,
                      ),
                    )
                  }
                  className="h-3.5 w-3.5 accent-vermilion"
                />
                {readOnly ? (
                  <span className="flex-1 text-ink">{item.text || "—"}</span>
                ) : (
                  <input
                    aria-label={`항목 ${idx + 1} 텍스트`}
                    value={item.text}
                    onChange={(e) =>
                      onChange?.(
                        items.map((it, i) =>
                          i === idx ? { ...it, text: e.target.value } : it,
                        ),
                      )
                    }
                    maxLength={200}
                    placeholder="체크 항목"
                    className="flex-1 border border-line bg-cream px-2 py-1 text-ink"
                  />
                )}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`항목 ${idx + 1} 삭제`}
                    onClick={() => onChange?.(items.filter((_, i) => i !== idx))}
                    className="flex-none cursor-pointer border border-line bg-transparent px-2 py-1 text-muted hover:border-vermilion hover:text-vermilion"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </div>
  );
}
