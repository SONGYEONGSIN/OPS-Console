"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";
import { DateInput } from "@/components/common/DateInput";

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

const SCHEDULE_TYPE_OPTIONS: {
  value:
    | "shift"
    | "event"
    | "leave"
    | "training"
    | "application"
    | "pims"
    | "external_meeting"
    | "meeting";
  label: string;
}[] = [
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
  { value: "application", label: "원서접수" },
  { value: "pims", label: "PIMS" },
  { value: "external_meeting", label: "외부미팅" },
  { value: "meeting", label: "회의" },
];

const KST_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const KST_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isoToKstDate(iso?: string | null): string {
  if (!iso) return "";
  return KST_DATE_FMT.format(new Date(iso));
}

function isoToKstTime(iso?: string | null): string {
  if (!iso) return "";
  return KST_TIME_FMT.format(new Date(iso));
}

/** date(YYYY-MM-DD KST) + time(HH:mm) → ISO 8601 Z. time 비어있으면 00:00. */
function combineKstToIso(date: string, time: string): string {
  if (!date) return "";
  const t = time || "00:00";
  return new Date(`${date}T${t}:00+09:00`).toISOString();
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          {SCHEDULE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="종일"
          checked={row.allDay ?? false}
          onChange={(e) => setRow({ ...row, allDay: e.target.checked })}
        />
        종일 일정
      </label>
      <div className="space-y-2">
        <span className="block text-xs text-muted">시작 (KST)</span>
        <div className={row.allDay ? "" : "grid grid-cols-[1fr_100px] gap-2"}>
          <DateInput
            aria-label="시작 날짜"
            value={isoToKstDate(row.start_at)}
            onChange={(e) =>
              setRow({
                ...row,
                start_at: combineKstToIso(
                  e.target.value,
                  isoToKstTime(row.start_at),
                ),
              })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          {row.allDay ? null : (
            <input
              type="time"
              aria-label="시작 시각"
              value={isoToKstTime(row.start_at)}
              onChange={(e) =>
                setRow({
                  ...row,
                  start_at: combineKstToIso(
                    isoToKstDate(row.start_at),
                    e.target.value,
                  ),
                })
              }
              className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
            />
          )}
        </div>
      </div>
      <div className="space-y-2">
        <span className="block text-xs text-muted">종료 (KST)</span>
        <div className={row.allDay ? "" : "grid grid-cols-[1fr_100px] gap-2"}>
          <DateInput
            aria-label="종료 날짜"
            value={isoToKstDate(row.end_at)}
            onChange={(e) =>
              setRow({
                ...row,
                end_at: e.target.value
                  ? combineKstToIso(e.target.value, isoToKstTime(row.end_at))
                  : null,
              })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          {row.allDay ? null : (
            <input
              type="time"
              aria-label="종료 시각"
              value={isoToKstTime(row.end_at)}
              onChange={(e) =>
                setRow({
                  ...row,
                  end_at: row.end_at
                    ? combineKstToIso(isoToKstDate(row.end_at), e.target.value)
                    : null,
                })
              }
              className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
            />
          )}
        </div>
      </div>
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft"
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
