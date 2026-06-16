"use client";

import { useState, type ReactNode } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { CategoryTabs } from "./CategoryTabs";
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
import { isFieldFilled } from "./progress";
import { FIELD_EXAMPLE } from "@/features/handover/field-examples";
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
  handoverServiceCandidates,
  onCopyHandover,
  contractsStatusOptions,
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
      <div className="mb-6">
        <CategoryTabs active={active} onChange={setActive} />
      </div>

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
                  className="w-full border border-line bg-cream px-2 py-1 text-ink"
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
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
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
      {onCopyHandover ? (
        <CopySection
          fromServiceId={row.id}
          candidates={handoverServiceCandidates ?? []}
          onCopy={onCopyHandover}
        />
      ) : null}
    </form>
  );
}

function CopySection({
  fromServiceId,
  candidates,
  onCopy,
}: {
  fromServiceId: string;
  candidates: NonNullable<EditFormProps["handoverServiceCandidates"]>;
  onCopy: NonNullable<EditFormProps["onCopyHandover"]>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const term = q.trim();
  const results = term
    ? candidates
        .filter((c) => c.id !== fromServiceId)
        .filter(
          (c) =>
            c.universityName.includes(term) ||
            c.serviceName.includes(term) ||
            String(c.serviceId).includes(term),
        )
        .slice(0, 12)
    : [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const overwriting = candidates.filter(
      (c) => ids.includes(c.id) && c.hasRecord,
    );
    if (overwriting.length > 0) {
      const names = overwriting
        .map((c) => `${c.universityName} · ${c.serviceName}`)
        .join("\n");
      if (
        !window.confirm(
          `다음 ${overwriting.length}개 서비스는 이미 작성된 내용이 있습니다. 덮어쓰시겠습니까?\n\n${names}`,
        )
      )
        return;
    }
    setPending(true);
    setMsg(null);
    const r = await onCopy(fromServiceId, ids);
    setPending(false);
    if (r.ok) {
      setMsg(`${r.copiedCount ?? ids.length}개 서비스로 복제 완료`);
      setSelected(new Set());
      setQ("");
    } else {
      setMsg(r.error ?? "복제 실패");
    }
  }

  return (
    <section className="mt-4 space-y-2 border-t border-line-soft pt-3">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted">
        다른 서비스로 복제
      </p>
      <p className="text-2xs text-muted">
        현재 내용을 1차 기준으로 2·3차 등 다른 서비스에 복사합니다.
      </p>
      <input
        aria-label="복제 대상 서비스 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="대학명 · 서비스명 · service_id 검색"
        className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink"
      />
      {term && results.length === 0 ? (
        <p className="text-2xs text-muted">검색 결과 없음</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto border border-line-soft p-1">
          {results.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs hover:bg-washi-raised">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5 accent-vermilion"
                />
                <span className="truncate text-ink">
                  {c.universityName} · {c.serviceName}
                </span>
                {c.hasRecord ? (
                  <span className="ml-auto shrink-0 bg-vermilion/20 px-1 py-0.5 text-2xs text-vermilion-deep">
                    작성됨
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.size > 0 ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="w-full border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
        >
          {pending ? "복제 중…" : `${selected.size}개 서비스로 복제`}
        </button>
      ) : null}
      {msg ? <p className="text-2xs text-ink-soft">{msg}</p> : null}
    </section>
  );
}
