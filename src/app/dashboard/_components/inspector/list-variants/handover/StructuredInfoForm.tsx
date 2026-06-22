"use client";

import { LinkifiedText } from "./LinkifiedText";

export type StructuredFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  /** 지정 시 텍스트 입력 대신 셀렉트로 렌더 */
  options?: readonly string[];
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
      {fields.map((f) => {
        const cur = value[f.key] ?? "";
        // 셀렉트: 현재 값이 옵션에 없으면(레거시) 옵션에 추가해 유실 방지
        const opts =
          f.options && cur && !f.options.includes(cur)
            ? [cur, ...f.options]
            : f.options;
        return (
          <label key={f.key} className="flex items-center gap-2">
            <span className="w-14 flex-none text-muted">{f.label}</span>
            {readOnly ? (
              <span className="flex-1 text-ink">{cur || "—"}</span>
            ) : opts ? (
              <select
                aria-label={f.label}
                value={cur}
                onChange={(e) =>
                  onChange?.({ ...value, [f.key]: e.target.value })
                }
                className="flex-1 border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
              >
                <option value="">선택</option>
                {opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={f.label}
                value={cur}
                onChange={(e) =>
                  onChange?.({ ...value, [f.key]: e.target.value })
                }
                maxLength={200}
                placeholder={f.placeholder}
                className="flex-1 border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
              />
            )}
          </label>
        );
      })}
      <label className="block">
        <span className="mb-1 block text-muted">메모</span>
        {readOnly ? (
          value.memo ? (
            <LinkifiedText text={value.memo} />
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
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          />
        )}
      </label>
    </div>
  );
}
