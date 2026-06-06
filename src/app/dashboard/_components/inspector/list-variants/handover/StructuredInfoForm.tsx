"use client";

export type StructuredFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
};

/**
 * 라벨드 고정 필드 + 메모 구조화 폼 (계약정보/정산 등 공용). 편집·읽기 겸용.
 * value는 { [fieldKey]: string, memo: string } 형상.
 */
export function StructuredInfoForm({
  fields,
  value,
  onChange,
  readOnly = false,
}: {
  fields: readonly StructuredFieldDef[];
  value: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2 text-xs">
      {fields.map((f) => (
        <label key={f.key} className="flex items-center gap-2">
          <span className="w-14 flex-none text-muted">{f.label}</span>
          {readOnly ? (
            <span className="flex-1 text-ink">{value[f.key] || "—"}</span>
          ) : (
            <input
              aria-label={f.label}
              value={value[f.key] ?? ""}
              onChange={(e) =>
                onChange?.({ ...value, [f.key]: e.target.value })
              }
              maxLength={200}
              placeholder={f.placeholder}
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
            aria-label="메모"
            value={value.memo ?? ""}
            onChange={(e) => onChange?.({ ...value, memo: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="추가 메모(선택)"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        )}
      </label>
    </div>
  );
}
