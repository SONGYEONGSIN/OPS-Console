"use client";

import { useState } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { Section, DefList, Divider } from "../shared";
import { CategoryTabs } from "./CategoryTabs";
import { ContractChecklist } from "./ContractChecklist";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { FIELD_EXAMPLE } from "@/features/handover/field-examples";

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

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  ready: "작성완료",
  published: "발행됨",
};

export function HandoverView({ row }: { row: ListRow }) {
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === active);
  if (!cat) return null;

  const basicItems = [
    { term: "학교명", desc: row.universityName ?? "—" },
    { term: "서비스", desc: row.serviceName ?? "—" },
    { term: "접수구분", desc: row.universityType ?? "—" },
    { term: "담당자", desc: row.owner ?? "—" },
    {
      term: "서비스번호",
      desc: row.handoverServiceNumber
        ? String(row.handoverServiceNumber)
        : "—",
    },
    {
      term: "작성상태",
      desc: row.handoverStatus ? STATUS_LABEL[row.handoverStatus] : "미작성",
    },
  ];

  return (
    <div className="space-y-4">
      <Section title="기본정보">
        <DefList items={basicItems} />
      </Section>

      <Divider />

      <Section title="카테고리">
        <CategoryTabs active={active} onChange={setActive} />
      </Section>

      <div className="space-y-3">
        {cat.fields.map((f) =>
          f.key === "contract_data_md" ? (
            <div key={f.key} className="space-y-2">
              <ContractChecklist
                items={row.handoverContractChecklist ?? []}
                readOnly
              />
              {pickValue(row, f.key) && (
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">메모</span>
                  <textarea
                    aria-label="계약자료 메모"
                    value={pickValue(row, f.key)}
                    readOnly
                    rows={3}
                    className="w-full border border-line bg-cream px-2 py-1 text-ink"
                  />
                </label>
              )}
            </div>
          ) : (
            <label key={f.key} className="block text-xs">
              <span className="mb-1 block text-muted">{f.label}</span>
              <textarea
                aria-label={f.label}
                value={pickValue(row, f.key)}
                readOnly
                rows={6}
                placeholder={FIELD_EXAMPLE[f.key]}
                className="w-full border border-line bg-cream px-2 py-1 text-ink"
              />
            </label>
          ),
        )}
      </div>
    </div>
  );
}
