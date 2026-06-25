"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type QuoteDocument,
  type QuoteType,
  type QuoteSection,
  type QuoteRow,
  QUOTE_TYPE_LABELS,
  QUOTE_TYPES,
  blankDocument,
} from "@/features/quotes/document-schema";
import { QUOTE_SENDER } from "@/features/quotes/sender";
import { recomputeDocument, koreanAmount, laborRollup } from "@/features/quotes/calc";
import { KOSA_2026, kosaDaily } from "@/features/quotes/kosa-2026";
import { saveQuoteDocument } from "@/features/quotes/document-actions";

// ────────────── 헬퍼 ──────────────

function formatKrw(n: number): string {
  return n === 0 ? "0" : n.toLocaleString("ko-KR");
}

function blankRow(section: QuoteSection): QuoteRow {
  return Object.fromEntries(section.columns.map((c) => [c.key, ""]));
}

// ────────────── 마스트헤드 ──────────────

interface HeaderField {
  key: keyof QuoteDocument["header"];
  label: string;
}

const HEADER_FIELDS: HeaderField[] = [
  { key: "recipient", label: "수신" },
  { key: "quoteName", label: "견적명" },
  { key: "quoteNo", label: "견적번호" },
  { key: "quoteDate", label: "견적일" },
  { key: "validUntil", label: "유효기간" },
  { key: "manager", label: "담당자" },
];

function Masthead({
  quoteType,
  header,
  onHeaderChange,
}: {
  quoteType: QuoteType;
  header: QuoteDocument["header"];
  onHeaderChange: (header: QuoteDocument["header"]) => void;
}) {
  function setField(key: keyof QuoteDocument["header"], value: string) {
    onHeaderChange({ ...header, [key]: value });
  }

  return (
    <div className="border border-line bg-washi p-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-ink">
          {QUOTE_TYPE_LABELS[quoteType]} 견적서
        </h1>
        <span className="text-xs text-muted">견적서</span>
      </div>

      {/* 수신처·메타 그리드 */}
      <div className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {HEADER_FIELDS.map(({ key, label }) => (
          <div key={key} className="contents">
            <span className="py-0.5 text-xs font-medium text-muted">{label}</span>
            <input
              type="text"
              value={header[key]}
              onChange={(e) => setField(key, e.target.value)}
              className="border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
              placeholder={`${label} 입력`}
            />
          </div>
        ))}
      </div>

      {/* 발신자 (읽기전용) */}
      <div className="border-t border-line pt-3">
        <p className="mb-1 text-xs font-medium text-muted">발신</p>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <span className="text-xs text-muted">상호</span>
          <span className="text-sm text-ink">{QUOTE_SENDER.company}</span>
          <span className="text-xs text-muted">대표자</span>
          <span className="text-sm text-ink">{QUOTE_SENDER.ceo}</span>
          {QUOTE_SENDER.address && (
            <>
              <span className="text-xs text-muted">주소</span>
              <span className="text-sm text-ink">{QUOTE_SENDER.address}</span>
            </>
          )}
          {QUOTE_SENDER.fax && (
            <>
              <span className="text-xs text-muted">팩스</span>
              <span className="text-sm text-ink">{QUOTE_SENDER.fax}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────── 노임단가 적산 내역 ──────────────

function LaborRollupBlock({ section }: { section: QuoteSection }) {
  const directSum = section.rows.reduce((acc, r) => {
    const num = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : 0);
    return acc + Math.round(num("count") * num("daily") * num("days") * num("ratio"));
  }, 0);
  const rates = section.rates ?? { overhead: 1.1, techFee: 0.2 };
  const rollup = laborRollup({ direct: directSum, overheadRate: rates.overhead, techFeeRate: rates.techFee });

  return (
    <div className="mt-2 border border-line bg-washi-raised px-3 py-2 text-xs">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
        <span className="text-muted">직접인건비합계</span>
        <span className="text-right text-ink">{formatKrw(rollup.direct)} 원</span>
        <span className="text-muted">제경비</span>
        <span className="text-right text-ink">{formatKrw(rollup.overhead)} 원</span>
        <span className="text-muted">기술료</span>
        <span className="text-right text-ink">{formatKrw(rollup.techFee)} 원</span>
        <span className="font-medium text-ink">인건비합계</span>
        <span className="text-right font-medium text-ink">{formatKrw(rollup.total)} 원</span>
      </div>
    </div>
  );
}

// ────────────── 노임단가 요율 입력 ──────────────

function LaborRatesRow({
  section,
  onSectionChange,
}: {
  section: QuoteSection;
  onSectionChange: (s: QuoteSection) => void;
}) {
  const rates = section.rates ?? { overhead: 1.1, techFee: 0.2 };

  function setRate(key: "overhead" | "techFee", value: number) {
    onSectionChange({ ...section, rates: { ...rates, [key]: value } });
  }

  return (
    <div className="mb-2 flex items-center gap-4 text-xs text-muted">
      <label className="flex items-center gap-1" htmlFor={`${section.id}-overhead`}>
        제경비율
        <input
          id={`${section.id}-overhead`}
          aria-label="제경비율"
          type="number"
          step="0.01"
          value={rates.overhead}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) setRate("overhead", n);
          }}
          className="w-16 border border-line bg-transparent px-1 py-0.5 text-right text-ink outline-none focus:border-ink"
        />
      </label>
      <label className="flex items-center gap-1" htmlFor={`${section.id}-techfee`}>
        기술료율
        <input
          id={`${section.id}-techfee`}
          aria-label="기술료율"
          type="number"
          step="0.01"
          value={rates.techFee}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) setRate("techFee", n);
          }}
          className="w-16 border border-line bg-transparent px-1 py-0.5 text-right text-ink outline-none focus:border-ink"
        />
      </label>
    </div>
  );
}

// ────────────── 섹션 표 ──────────────

function SectionTable({
  section,
  onSectionChange,
}: {
  section: QuoteSection;
  onSectionChange: (s: QuoteSection) => void;
}) {
  const isLabor = section.kind === "labor";

  function setCell(rowIdx: number, key: string, value: string | number) {
    const rows = section.rows.map((r, i) =>
      i === rowIdx ? { ...r, [key]: value } : r,
    );
    onSectionChange({ ...section, rows });
  }

  function setLaborGrade(rowIdx: number, gradeKey: string) {
    const daily = kosaDaily(gradeKey);
    const grade = KOSA_2026.find((g) => g.key === gradeKey);
    const rows = section.rows.map((r, i) => {
      if (i !== rowIdx) return r;
      return { ...r, daily, role: grade ? grade.name : r.role };
    });
    onSectionChange({ ...section, rows });
  }

  function addRow() {
    onSectionChange({
      ...section,
      rows: [...section.rows, blankRow(section)],
    });
  }

  function deleteRow(rowIdx: number) {
    onSectionChange({
      ...section,
      rows: section.rows.filter((_, i) => i !== rowIdx),
    });
  }

  return (
    <div className="mb-2">
      <div className="mb-1 text-xs font-medium text-muted">{section.title}</div>
      {isLabor && (
        <LaborRatesRow section={section} onSectionChange={onSectionChange} />
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-washi-raised text-left text-xs text-muted">
            {section.columns.map((col) => (
              <th
                key={col.key}
                className={`border border-line px-2 py-1.5 ${col.kind === "amount" ? "text-right" : ""}`}
              >
                {col.label}
              </th>
            ))}
            {/* 삭제 열 헤더 */}
            <th className="w-8 border border-line px-1 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {section.rows.length === 0 ? (
            <tr>
              <td
                colSpan={section.columns.length + 1}
                className="border border-line py-3 text-center text-xs text-muted"
              >
                행 없음
              </td>
            </tr>
          ) : (
            section.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-washi-raised">
                {section.columns.map((col) => {
                  const raw = row[col.key];
                  const strVal = raw == null ? "" : String(raw);

                  // labor 섹션: direct 컬럼은 읽기전용(자동계산)
                  if (isLabor && col.key === "direct") {
                    const numVal = typeof raw === "number" ? raw : 0;
                    return (
                      <td
                        key={col.key}
                        className="border border-line bg-washi-raised px-2 py-0.5 text-right text-xs text-muted"
                      >
                        {formatKrw(numVal)}
                      </td>
                    );
                  }

                  // labor 섹션: daily 컬럼은 등급 드롭다운 + 숫자 직접 입력
                  if (isLabor && col.key === "daily") {
                    const numVal = typeof raw === "number" ? raw : 0;
                    return (
                      <td key={col.key} className="border border-line px-1 py-0.5">
                        <div className="flex items-center gap-1">
                          <select
                            aria-label="등급 선택"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) setLaborGrade(rowIdx, e.target.value);
                            }}
                            className="border border-line bg-cream px-1 py-0.5 text-xs text-ink outline-none focus:border-ink"
                          >
                            <option value="">등급 선택</option>
                            {KOSA_2026.map((g) => (
                              <option key={g.key} value={g.key}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={numVal === 0 ? "" : numVal}
                            onChange={(e) => {
                              const n = e.target.value === "" ? 0 : Number(e.target.value);
                              setCell(rowIdx, col.key, isNaN(n) ? 0 : n);
                            }}
                            className="w-24 bg-transparent text-right text-sm text-ink outline-none"
                            placeholder="0"
                          />
                        </div>
                      </td>
                    );
                  }

                  if (col.kind === "amount") {
                    const numVal = typeof raw === "number" ? raw : 0;
                    return (
                      <td
                        key={col.key}
                        className="border border-line px-1 py-0.5 text-right"
                      >
                        <input
                          type="number"
                          value={numVal === 0 ? "" : numVal}
                          onChange={(e) => {
                            const n = e.target.value === "" ? 0 : Number(e.target.value);
                            setCell(rowIdx, col.key, isNaN(n) ? 0 : n);
                          }}
                          className="w-full bg-transparent text-right text-sm text-ink outline-none"
                          placeholder="0"
                        />
                      </td>
                    );
                  }
                  if (col.kind === "multiline") {
                    return (
                      <td key={col.key} className="border border-line px-1 py-0.5">
                        <textarea
                          rows={2}
                          value={strVal}
                          onChange={(e) =>
                            setCell(rowIdx, col.key, e.target.value)
                          }
                          className="w-full resize-none bg-transparent text-sm text-ink outline-none"
                          placeholder=""
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className="border border-line px-1 py-0.5">
                      <input
                        type="text"
                        value={strVal}
                        onChange={(e) => setCell(rowIdx, col.key, e.target.value)}
                        className="w-full bg-transparent text-sm text-ink outline-none"
                        placeholder=""
                      />
                    </td>
                  );
                })}
                <td className="border border-line px-1 py-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIdx)}
                    className="text-xs text-muted transition-colors hover:text-vermilion"
                    aria-label="행 삭제"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        className="mt-1 text-xs text-muted transition-colors hover:text-ink"
        aria-label="행 추가"
      >
        + 행 추가
      </button>
      {isLabor && <LaborRollupBlock section={section} />}
    </div>
  );
}

// ────────────── 합계 영역 ──────────────

function TotalsBlock({ totals }: { totals: QuoteDocument["totals"] }) {
  return (
    <div className="border border-line bg-washi-raised p-4">
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <span className="text-xs text-muted">공급가액</span>
        <span className="text-right text-sm text-ink">
          {formatKrw(totals.supply)} 원
        </span>
        <span className="text-xs text-muted">부가세</span>
        <span className="text-right text-sm text-ink">
          {formatKrw(totals.vat)} 원
        </span>
        <span className="font-bold text-ink">합계</span>
        <span className="text-right font-bold text-ink">
          {formatKrw(totals.total)} 원
        </span>
      </div>
      {totals.total > 0 && (
        <p className="mt-2 text-xs text-muted">
          일금 {koreanAmount(totals.total)}원 정 (VAT 포함)
        </p>
      )}
    </div>
  );
}

// ────────────── 약관 ──────────────

function TermsEditor({
  terms,
  onTermsChange,
}: {
  terms: string[];
  onTermsChange: (terms: string[]) => void;
}) {
  function setTerm(idx: number, value: string) {
    onTermsChange(terms.map((t, i) => (i === idx ? value : t)));
  }

  function addTerm() {
    onTermsChange([...terms, ""]);
  }

  function deleteTerm(idx: number) {
    onTermsChange(terms.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">약관 및 특기사항</p>
      {terms.map((term, idx) => (
        <div key={idx} className="mb-1 flex items-center gap-2">
          <span className="text-xs text-muted">{idx + 1}.</span>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(idx, e.target.value)}
            className="flex-1 border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
            placeholder="약관 내용 입력"
          />
          <button
            type="button"
            onClick={() => deleteTerm(idx)}
            className="text-xs text-muted transition-colors hover:text-vermilion"
            aria-label="약관 삭제"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addTerm}
        className="mt-1 text-xs text-muted transition-colors hover:text-ink"
      >
        + 약관 추가
      </button>
    </div>
  );
}

// ────────────── 메인 에디터 ──────────────

export interface QuoteDocumentEditorProps {
  id: string;
  quoteType: QuoteType;
  document: QuoteDocument;
  customer: string;
  onSave: typeof saveQuoteDocument;
}

export function QuoteDocumentEditor({
  id,
  quoteType: initialQuoteType,
  document: initialDocument,
  customer,
  onSave,
}: QuoteDocumentEditorProps) {
  const [currentQuoteType, setCurrentQuoteType] =
    useState<QuoteType>(initialQuoteType);
  const [doc, setDoc] = useState<QuoteDocument>(() => {
    // 신규 문서(recipient 비어있음)일 때만 customer로 prefill
    const seed =
      !initialDocument.header.recipient && customer
        ? {
            ...initialDocument,
            header: { ...initialDocument.header, recipient: customer },
          }
        : initialDocument;
    return recomputeDocument(seed);
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateDoc(next: QuoteDocument) {
    setDoc(recomputeDocument(next));
    setSaved(false);
  }

  function handleTypeChange(newType: QuoteType) {
    const hasRows = doc.sections.some((s) => s.rows.length > 0);
    if (hasRows) {
      const confirmed = window.confirm(
        `유형을 변경하면 입력된 섹션 행이 초기화됩니다. 계속하시겠습니까?`,
      );
      if (!confirmed) return;
    }
    const newDoc = blankDocument(newType);
    // 머리말·약관 보존
    updateDoc({ ...newDoc, header: doc.header, terms: doc.terms });
    setCurrentQuoteType(newType);
  }

  function onHeaderChange(header: QuoteDocument["header"]) {
    updateDoc({ ...doc, header });
  }

  function onSectionChange(idx: number, section: QuoteSection) {
    const sections = doc.sections.map((s, i) => (i === idx ? section : s));
    updateDoc({ ...doc, sections });
  }

  function onTermsChange(terms: string[]) {
    updateDoc({ ...doc, terms });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const res = await onSave(id, doc, currentQuoteType);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      setSaveError(res.error ?? "저장 실패");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 상단바 */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/dashboard/quotes"
          className="inline-flex shrink-0 items-center border border-line px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          ← 목록 이동
        </Link>
        <div className="flex items-center gap-3">
          {/* 유형 선택기 */}
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span>견적서 유형</span>
            <select
              aria-label="견적서 유형"
              value={currentQuoteType}
              onChange={(e) => {
                const val = e.target.value;
                if ((QUOTE_TYPES as readonly string[]).includes(val))
                  handleTypeChange(val as QuoteType);
              }}
              className="border border-line bg-cream px-2 py-1 text-sm text-ink outline-none focus:border-ink"
            >
              {QUOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUOTE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {saveError && (
            <span className="text-xs text-vermilion">{saveError}</span>
          )}
          {saved && !saving && (
            <span className="text-xs text-muted">저장됨</span>
          )}
          <a
            href={`/api/quotes/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-ink bg-transparent px-4 py-1.5 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            PDF
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="border border-ink bg-transparent px-4 py-1.5 text-sm text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 pb-6 pt-2">
        {/* 마스트헤드 */}
        <Masthead
          quoteType={currentQuoteType}
          header={doc.header}
          onHeaderChange={onHeaderChange}
        />

        {/* 섹션 표 */}
        <div className="space-y-4">
          {doc.sections.map((section, idx) => (
            <SectionTable
              key={section.id}
              section={section}
              onSectionChange={(s) => onSectionChange(idx, s)}
            />
          ))}
        </div>

        {/* 합계 */}
        <TotalsBlock totals={doc.totals} />

        {/* 약관 */}
        <TermsEditor terms={doc.terms} onTermsChange={onTermsChange} />
      </div>
    </div>
  );
}
