import { useState } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";

const COHORT_STATUS_OPTIONS: {
  value: "planned" | "in_progress" | "completed";
  label: string;
}[] = [
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
];

export function CohortForm({
  row,
  setRow,
  onSave,
  onCancel,
  onInvite,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [inviting, setInviting] = useState(false);
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
          placeholder="회차 제목 (예: 2026 Q2 신입 — 김지나)"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">신입</span>
          <select
            aria-label="신입"
            value={row.traineeEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = OPERATORS.find((o) => o.email === email);
              setRow({
                ...row,
                traineeEmail: email,
                author: op?.name ?? email,
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {OPERATORS.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">교육 (선택)</span>
          <select
            aria-label="교육"
            value={row.mentorEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value || null;
              const op = email
                ? OPERATORS.find((o) => o.email === email)
                : null;
              setRow({
                ...row,
                mentorEmail: email,
                owner: op?.name ?? "",
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">미정</option>
            {OPERATORS.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작일</span>
          <input
            type="date"
            aria-label="시작일"
            value={row.startDate ?? ""}
            onChange={(e) => setRow({ ...row, startDate: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">종료일 (선택)</span>
          <input
            type="date"
            aria-label="종료일"
            value={row.endDate ?? ""}
            onChange={(e) =>
              setRow({ ...row, endDate: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={row.cohortStatus ?? "planned"}
          onChange={(e) =>
            setRow({
              ...row,
              cohortStatus: e.target.value as ListRow["cohortStatus"],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {COHORT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">비고</span>
        <textarea
          aria-label="비고"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={3}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="자유 메모"
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
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && onInvite && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            disabled={inviting}
            onClick={async () => {
              if (
                !window.confirm(
                  row.invitedAt
                    ? "다시 초대 메일을 발송하시겠습니까?"
                    : "초대 메일을 발송하시겠습니까?",
                )
              )
                return;
              setInviting(true);
              const result = await onInvite(row.id);
              setInviting(false);
              if (result.ok) {
                alert("초대 메일이 발송되었습니다.");
              } else {
                alert(`발송 실패: ${result.error ?? "알 수 없는 오류"}`);
              }
            }}
            className="w-full border border-vermilion bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            {inviting
              ? "발송 중…"
              : row.invitedAt
                ? "재초대 메일 발송"
                : "초대 메일 발송"}
          </button>
        </div>
      )}
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("이 회차를 삭제하시겠습니까? 되돌릴 수 없습니다.")
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
