"use client";

import { useState, type ReactNode } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { DefList, Divider } from "../shared";
import { CategoryTabs } from "./CategoryTabs";
import { ContractChecklist } from "./ContractChecklist";
import { ContractInfoForm } from "./ContractInfoForm";
import { CollapsibleField } from "./CollapsibleField";
import { CopyButton } from "./CopyButton";
import { StructuredInfoForm } from "./StructuredInfoForm";
import {
  PAYMENT_FEE_FIELDS,
  PAYMENT_INVOICE_FIELDS,
  EMPTY_PAYMENT_FEE,
  EMPTY_PAYMENT_INVOICE,
} from "./payment-fields";
import { isFieldFilled } from "./progress";
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

// 작성상태 칩 — 목록(HandoverTable)과 동일한 라벨/음영
const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-vermilion/15 text-vermilion",
  ready: "bg-sage/15 text-sage",
  published: "bg-ink/10 text-ink",
};

function StatusValue({ status }: { status?: string }) {
  const label = (status && STATUS_LABEL[status]) || "미작성";
  const tone = (status && STATUS_TONE[status]) || "bg-washi-raised text-muted";
  return (
    <span className={`inline-block px-2 py-0.5 text-2xs ${tone}`}>
      {label}
    </span>
  );
}

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
      desc: <StatusValue status={row.handoverStatus} />,
    },
  ];

  return (
    <div className="space-y-4">
      <DefList items={basicItems} />

      <Divider />

      <div className="mb-6">
        <CategoryTabs active={active} onChange={setActive} row={row} />
      </div>

      <div className="space-y-3">
        {cat.fields.map((f) => {
          // 모든 필드를 접이식(아코디언)으로 — 작성된 필드는 펼친 채 시작.
          const filled = isFieldFilled(row, f.key);
          let body: ReactNode;
          if (f.key === "contract_info_md") {
            body = (
              <ContractInfoForm
                embedded
                value={
                  row.handoverContractInfo ?? {
                    title: "",
                    type: "",
                    progress: "",
                    status: "",
                    memo: "",
                  }
                }
                readOnly
              />
            );
          } else if (f.key === "contract_data_md" || f.key === "docs_md") {
            const isDocs = f.key === "docs_md";
            body = (
              <ContractChecklist
                embedded
                label={isDocs ? "제출서류" : "계약서류"}
                items={
                  (isDocs
                    ? row.handoverDocsChecklist
                    : row.handoverContractChecklist) ?? []
                }
                readOnly
              >
                {pickValue(row, f.key) && (
                  <label className="block text-xs">
                    <span className="mb-1 block text-muted">메모</span>
                    <textarea
                      aria-label={isDocs ? "서류 메모" : "계약자료 메모"}
                      value={pickValue(row, f.key)}
                      readOnly
                      rows={3}
                      className="w-full border border-line bg-cream px-2 py-1 text-ink"
                    />
                  </label>
                )}
              </ContractChecklist>
            );
          } else if (f.key === "school_contact_md") {
            body =
              (row.handoverSchoolContacts ?? []).length === 0 ? (
                <p className="border border-dashed border-line-soft bg-cream px-2 py-2 text-2xs text-muted">
                  등록된 학교담당자가 없습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {(row.handoverSchoolContacts ?? []).map((c) => (
                    <li
                      key={c.id}
                      className="border border-line bg-cream px-2 py-1.5"
                    >
                      <p className="text-ink">
                        {c.name}
                        {c.jobTitle ? ` (${c.jobTitle})` : ""}
                      </p>
                      {c.phone ? (
                        <div className="flex items-center gap-1.5">
                          <p className="text-2xs text-muted">{c.phone}</p>
                          <CopyButton value={c.phone} label={`${c.name} 전화`} />
                        </div>
                      ) : null}
                      {c.email ? (
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-2xs text-muted">
                            {c.email}
                          </p>
                          <CopyButton
                            value={c.email}
                            label={`${c.name} 이메일`}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              );
          } else if (f.key === "payment_fee_md") {
            body = (
              <StructuredInfoForm
                fields={PAYMENT_FEE_FIELDS}
                value={row.handoverPaymentFee ?? EMPTY_PAYMENT_FEE}
                readOnly
              />
            );
          } else if (f.key === "payment_invoice_md") {
            body = (
              <StructuredInfoForm
                fields={PAYMENT_INVOICE_FIELDS}
                value={row.handoverPaymentInvoice ?? EMPTY_PAYMENT_INVOICE}
                readOnly
              />
            );
          } else {
            body = pickValue(row, f.key).trim() ? (
              <textarea
                aria-label={f.label}
                value={pickValue(row, f.key)}
                readOnly
                rows={6}
                className="w-full border border-line bg-cream px-2 py-1 text-ink"
              />
            ) : (
              <p className="text-2xs text-faint">작성된 내용이 없습니다.</p>
            );
          }
          return (
            <CollapsibleField key={f.key} label={f.label} filled={filled}>
              {body}
            </CollapsibleField>
          );
        })}
      </div>
    </div>
  );
}
