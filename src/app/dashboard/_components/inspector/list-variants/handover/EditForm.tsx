"use client";

import { useState } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import type { EditFormProps } from "../types";

const ROW_TO_FIELD: Record<HandoverFieldKey, keyof ListRow> = {
  contract_info_md: "handoverContractInfoMd",
  contract_data_md: "handoverContractDataMd",
  work_basic_md: "handoverWorkBasicMd",
  work_generator_md: "handoverWorkGeneratorMd",
  work_site_md: "handoverWorkSiteMd",
  work_output_md: "handoverWorkOutputMd",
  work_rate_md: "handoverWorkRateMd",
  work_file_md: "handoverWorkFileMd",
  work_etc_md: "handoverWorkEtcMd",
  payment_fee_md: "handoverPaymentFeeMd",
  payment_invoice_md: "handoverPaymentInvoiceMd",
  school_contact_md: "handoverSchoolContactMd",
  docs_md: "handoverDocsMd",
  notes_md: "handoverNotesMd",
};

function pickValue(row: ListRow, key: HandoverFieldKey): string {
  const v = row[ROW_TO_FIELD[key]];
  return typeof v === "string" ? v : "";
}

export function HandoverEditForm({
  row,
  setRow,
  onSave,
  onCancel,
}: EditFormProps) {
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === active);
  if (!cat) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">카테고리</span>
        <select
          aria-label="카테고리"
          value={active}
          onChange={(e) => setActive(e.target.value as HandoverCategoryKey)}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {HANDOVER_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {cat.fields.map((f) => (
        <label key={f.key} className="block text-xs">
          <span className="mb-1 block text-muted">{f.label}</span>
          <textarea
            aria-label={f.label}
            value={pickValue(row, f.key)}
            onChange={(e) =>
              setRow((prev) => ({
                ...prev,
                [ROW_TO_FIELD[f.key]]: e.target.value,
              }))
            }
            rows={6}
            maxLength={10000}
            placeholder="내용을 입력해주세요"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      ))}

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
    </form>
  );
}
