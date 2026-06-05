"use client";

import type { ContractInfo } from "@/features/handover/schemas";

const FIELDS: { key: keyof Omit<ContractInfo, "memo">; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "type", label: "형태" },
  { key: "progress", label: "진행" },
  { key: "status", label: "상태" },
];

const PLACEHOLDER: Record<string, string> = {
  title: "예: 원서접수",
  type: "예: 수의",
  progress: "예: 운영자",
  status: "예: 완료",
};

/**
 * 계약정보 — 고정 필드 폼(제목/형태/진행/상태 + 메모). 편집·읽기 겸용.
 */
export function ContractInfoForm({
  value,
  onChange,
  readOnly = false,
}: {
  value: ContractInfo;
  onChange?: (next: ContractInfo) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5 text-xs">
      <span className="block text-muted">계약정보</span>
      <div className="space-y-2 border-y border-line py-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2">
            <span className="w-10 flex-none text-muted">{f.label}</span>
            {readOnly ? (
              <span className="flex-1 text-ink">{value[f.key] || "—"}</span>
            ) : (
              <input
                aria-label={f.label}
                value={value[f.key]}
                onChange={(e) =>
                  onChange?.({ ...value, [f.key]: e.target.value })
                }
                maxLength={f.key === "title" ? 200 : 100}
                placeholder={PLACEHOLDER[f.key]}
                className="flex-1 border border-line bg-cream px-2 py-1 text-ink"
              />
            )}
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-muted">메모</span>
          {readOnly ? (
            value.memo ? (
              <p className="whitespace-pre-wrap text-ink">{value.memo}</p>
            ) : (
              <p className="text-faint">—</p>
            )
          ) : (
            <textarea
              aria-label="계약정보 메모"
              value={value.memo}
              onChange={(e) => onChange?.({ ...value, memo: e.target.value })}
              rows={2}
              maxLength={2000}
              placeholder="예: ※ 학부 계약시 포함"
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            />
          )}
        </label>
      </div>
    </div>
  );
}
