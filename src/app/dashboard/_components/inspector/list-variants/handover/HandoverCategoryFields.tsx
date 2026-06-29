"use client";

import { type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { ContractChecklist } from "./ContractChecklist";
import { ContractInfoForm } from "./ContractInfoForm";
import { SchoolContactPicker } from "./SchoolContactPicker";
import { CollapsibleField } from "./CollapsibleField";
import { StructuredInfoForm } from "./StructuredInfoForm";
import {
  PAYMENT_FEE_FIELDS,
  PAYMENT_INVOICE_FIELDS,
  EMPTY_PAYMENT_FEE,
  EMPTY_PAYMENT_INVOICE,
} from "./payment-fields";
import { isFieldFilled, ROW_TO_FIELD } from "./progress";
import { FIELD_EXAMPLE } from "@/features/handover/field-examples";

function pickValue(row: ListRow, key: HandoverFieldKey): string {
  const v = row[ROW_TO_FIELD[key]];
  return typeof v === "string" ? v : "";
}

export function HandoverCategoryFields({
  row,
  setRow,
  category,
  contractsStatusOptions,
}: {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  category: HandoverCategoryKey;
  contractsStatusOptions?: readonly string[];
}) {
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === category);
  if (!cat) return null;

  return (
    <div className="space-y-3">
      {cat.fields.map((f) => {
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
              onChange={(next) =>
                setRow((prev) => ({ ...prev, handoverContractInfo: next }))
              }
              universityName={row.universityName ?? undefined}
              statusOptions={contractsStatusOptions ?? []}
            />
          );
        } else if (f.key === "school_contact_md") {
          body = (
            <SchoolContactPicker
              embedded
              candidates={row.handoverSchoolContactCandidates ?? []}
              items={row.handoverSchoolContacts ?? []}
              onChange={(next) =>
                setRow((prev) => ({ ...prev, handoverSchoolContacts: next }))
              }
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
              onChange={(items) =>
                setRow((prev) => ({
                  ...prev,
                  ...(isDocs
                    ? { handoverDocsChecklist: items }
                    : { handoverContractChecklist: items }),
                }))
              }
            >
              <label className="block text-xs">
                <span className="mb-1 block text-muted">메모</span>
                <textarea
                  aria-label={isDocs ? "서류 메모" : "계약자료 메모"}
                  value={pickValue(row, f.key)}
                  onChange={(e) =>
                    setRow((prev) => ({
                      ...prev,
                      [ROW_TO_FIELD[f.key]]: e.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={10000}
                  placeholder="추가 메모(선택)"
                  className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
                />
              </label>
            </ContractChecklist>
          );
        } else if (f.key === "payment_fee_md") {
          body = (
            <StructuredInfoForm
              fields={PAYMENT_FEE_FIELDS}
              value={row.handoverPaymentFee ?? EMPTY_PAYMENT_FEE}
              onChange={(next) =>
                setRow((prev) => ({
                  ...prev,
                  handoverPaymentFee: next as ListRow["handoverPaymentFee"],
                }))
              }
            />
          );
        } else if (f.key === "payment_invoice_md") {
          body = (
            <StructuredInfoForm
              fields={PAYMENT_INVOICE_FIELDS}
              value={row.handoverPaymentInvoice ?? EMPTY_PAYMENT_INVOICE}
              onChange={(next) =>
                setRow((prev) => ({
                  ...prev,
                  handoverPaymentInvoice:
                    next as ListRow["handoverPaymentInvoice"],
                }))
              }
            />
          );
        } else {
          body = (
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
              placeholder={FIELD_EXAMPLE[f.key]}
              className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            />
          );
        }
        return (
          <CollapsibleField
            key={f.key}
            label={f.label}
            filled={filled}
            defaultOpen={filled}
          >
            {body}
          </CollapsibleField>
        );
      })}
    </div>
  );
}
