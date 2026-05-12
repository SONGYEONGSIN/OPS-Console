"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

const SCHEDULE_TYPE_OPTIONS: {
  value: "shift" | "event" | "leave" | "training";
  label: string;
}[] = [
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
];

/**
 * ISO 8601 (Z) → datetime-local input 형식 ("YYYY-MM-DDTHH:mm") for KST.
 */
function isoToLocalKst(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  // UTC + 9h shift, then strip 'Z' and seconds.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

/**
 * datetime-local input ("YYYY-MM-DDTHH:mm", KST 가정) → ISO 8601 Z.
 */
function localKstToIso(local: string): string {
  if (!local) return "";
  return new Date(`${local}:00+09:00`).toISOString();
}

export function ScheduleForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="일정 제목"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">설명</span>
        <textarea
          aria-label="설명"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={4}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">타입</span>
        <select
          aria-label="타입"
          value={row.scheduleType ?? "event"}
          onChange={(e) =>
            setRow({
              ...row,
              scheduleType: e.target.value as ListRow["scheduleType"],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {SCHEDULE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작 (KST)</span>
          <input
            type="datetime-local"
            aria-label="시작"
            value={isoToLocalKst(row.start_at)}
            onChange={(e) =>
              setRow({ ...row, start_at: localKstToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">종료 (KST)</span>
          <input
            type="datetime-local"
            aria-label="종료"
            value={isoToLocalKst(row.end_at ?? undefined)}
            onChange={(e) =>
              setRow({
                ...row,
                end_at: e.target.value ? localKstToIso(e.target.value) : null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="종일"
          checked={row.allDay ?? false}
          onChange={(e) => setRow({ ...row, allDay: e.target.checked })}
        />
        종일 일정
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당자</span>
        <select
          aria-label="담당자"
          value={row.assigneeEmail ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              assigneeEmail: e.target.value || null,
              owner: e.target.value
                ? (OPERATORS.find((o) => o.email === e.target.value)?.name ??
                  "")
                : "",
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="">팀 공통 (담당자 없음)</option>
          {OPERATORS.map((op) => (
            <option key={op.email} value={op.email}>
              {op.name} · {op.role}
            </option>
          ))}
        </select>
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
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.",
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
