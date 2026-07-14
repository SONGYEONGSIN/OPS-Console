import { EMAIL_RE, toISODateInput } from "./helpers";
import type { EditFormProps } from "../types";
import { DateInput } from "@/components/common/DateInput";

export function ReceivablesForm({
  row,
  setRow,
  onSave,
  onCancel,
}: EditFormProps) {
  const cells = row.receivablesCells;
  if (!cells) {
    return (
      <p className="text-sm text-muted">편집 가능한 셀 정보가 없습니다.</p>
    );
  }
  const remarksIdx = cells.remarksHeaderIdx;
  const dueDateIdx = cells.dueDateHeaderIdx;
  const schoolOwnerIdx = cells.schoolOwnerHeaderIdx;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="border border-line-soft bg-washi-raised p-3 text-xs text-muted">
        <p>
          편집 가능:{" "}
          <strong className="text-ink">입금예정일 · 적요 · 학교담당자</strong>.
          나머지 셀은 SharePoint 원본 그대로 표시됩니다.
        </p>
      </div>

      <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 text-xs">
        {cells.headers.map((h, i) => {
          const isEditable =
            i === remarksIdx || i === dueDateIdx || i === schoolOwnerIdx;
          const value =
            i === remarksIdx
              ? (cells.remarks ?? "")
              : i === dueDateIdx
                ? (cells.dueDate ?? "")
                : i === schoolOwnerIdx
                  ? (cells.schoolOwner ?? "")
                  : (cells.textValues[i] ?? "");

          return (
            <div key={i} className="contents">
              <dt className="self-start pt-1 text-muted">{h}</dt>
              <dd>
                {!isEditable ? (
                  <p className="whitespace-pre-wrap pt-1 text-sm text-ink-soft">
                    {value || "—"}
                  </p>
                ) : i === remarksIdx ? (
                  <textarea
                    aria-label={h}
                    value={value}
                    onChange={(e) =>
                      setRow({
                        ...row,
                        receivablesCells: {
                          ...cells,
                          remarks: e.target.value,
                        },
                      })
                    }
                    rows={3}
                    className="w-full border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
                    placeholder="입금완료, 메일 발송 완료 등"
                  />
                ) : i === dueDateIdx ? (
                  <DateInput
                    aria-label={h}
                    value={toISODateInput(value)}
                    onChange={(e) =>
                      setRow({
                        ...row,
                        receivablesCells: {
                          ...cells,
                          dueDate: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
                  />
                ) : (
                  <div className="space-y-1">
                    <input
                      type="email"
                      aria-label={h}
                      value={value}
                      onChange={(e) =>
                        setRow({
                          ...row,
                          receivablesCells: {
                            ...cells,
                            schoolOwner: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
                      placeholder="manager@school.ac.kr"
                    />
                    {value && !EMAIL_RE.test(value.trim()) ? (
                      <p className="text-[11px] text-vermilion-deep">
                        ※ 이메일 형식이 올바르지 않습니다 (저장은 가능)
                      </p>
                    ) : null}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

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
    </form>
  );
}
