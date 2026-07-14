"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import type { EditFormProps } from "../types";

const FIELDS = [
  {
    key: "operator" as const,
    label: "운영자",
    cellKey: "contractsCellOperator" as const,
    valueKey: "owner" as const,
  },
  {
    key: "status" as const,
    label: "계약진행현황",
    cellKey: "contractsCellStatus" as const,
    valueKey: "contractStatus" as const,
  },
  {
    key: "serviceActive" as const,
    label: "서비스여부",
    cellKey: "contractsCellServiceActive" as const,
    valueKey: "serviceActive" as const,
  },
  {
    key: "feeAmount" as const,
    label: "수수료(VAT포함)",
    cellKey: "contractsCellFeeAmount" as const,
    valueKey: "feeAmount" as const,
  },
];

function readValue(row: ListRow, key: keyof ListRow): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

export function ContractsEditForm({
  row,
  setRow,
  onSave,
  onCancel,
  contractsStatusOptions,
  contractsServiceActiveOptions,
}: EditFormProps) {
  const optionsByKey: Record<string, readonly string[] | undefined> = {
    status: contractsStatusOptions,
    serviceActive: contractsServiceActiveOptions,
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="border-b border-line-soft pb-2 text-xs text-muted">
        시트: {row.contractsSheet ?? "—"} · 넘버링: {row.numbering ?? "—"}
        <br />
        이름: {row.name}
      </div>

      {FIELDS.map((f) => {
        const cell = row[f.cellKey];
        const readonly = cell === null || cell === undefined;
        const options = optionsByKey[f.key];
        const listId = options ? `contracts-${f.key}-list` : undefined;
        return (
          <label key={f.key} className="block text-xs">
            <span className="mb-1 block text-muted">
              {f.label}
              {readonly && (
                <span className="ml-2 text-vermilion">(헤더 미발견 · 편집 불가)</span>
              )}
              {!readonly && cell && (
                <span className="ml-2 font-mono text-ink-soft">셀 {cell}</span>
              )}
            </span>
            <input
              aria-label={f.label}
              value={readValue(row, f.valueKey)}
              onChange={(e) =>
                setRow((prev) => ({ ...prev, [f.valueKey]: e.target.value }))
              }
              readOnly={readonly}
              list={listId}
              className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white disabled:bg-washi-raised read-only:bg-washi-raised"
            />
            {options && options.length > 0 && (
              <datalist id={listId}>
                {options.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
          </label>
        );
      })}

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
