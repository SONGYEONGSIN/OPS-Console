"use client";

import { useState } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";

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

export function HandoverView({ row }: { row: ListRow }) {
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === active);
  if (!cat) return null;

  return (
    <div className="space-y-3">
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
            readOnly
            rows={6}
            placeholder="미작성"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      ))}
    </div>
  );
}
