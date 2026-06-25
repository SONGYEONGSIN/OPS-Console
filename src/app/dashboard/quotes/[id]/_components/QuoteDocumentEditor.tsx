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

// ────────────── 공통 헤더 ──────────────

interface HeaderField {
  key: keyof QuoteDocument["header"];
  label: string;
}

const HEADER_LEFT_FIELDS: HeaderField[] = [
  { key: "recipient", label: "수신" },
  { key: "quoteName", label: "견적명" },
  { key: "recipientCount", label: "접수인원" },
];

const HEADER_LEFT_TAIL_FIELDS: HeaderField[] = [
  { key: "quoteDate", label: "견적일자" },
  { key: "validUntil", label: "유효기간" },
  { key: "paymentTerms", label: "결제조건" },
];

function HeaderInputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="contents">
      <span className="py-0.5 text-xs font-medium text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
        placeholder={`${label} 입력`}
      />
    </div>
  );
}

function SenderRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="py-0.5 text-xs text-muted">{label}</span>
      <span className="py-0.5 text-sm text-ink">{value}</span>
    </>
  );
}

function DocumentHeader({
  header,
  total,
  onHeaderChange,
}: {
  header: QuoteDocument["header"];
  total: number;
  onHeaderChange: (header: QuoteDocument["header"]) => void;
}) {
  function setField(key: keyof QuoteDocument["header"], value: string) {
    onHeaderChange({ ...header, [key]: value });
  }

  return (
    <div className="grid grid-cols-2 gap-x-8 border-b border-ink pb-5">
      {/* 좌측: 견적 정보 */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {HEADER_LEFT_FIELDS.map(({ key, label }) => (
          <HeaderInputRow
            key={key}
            label={label}
            value={header[key]}
            onChange={(v) => setField(key, v)}
          />
        ))}
        {/* 견적비용 — totals.total 파생, 읽기전용 */}
        <span className="py-0.5 text-xs font-medium text-muted">견적비용</span>
        <span className="py-0.5 text-sm font-bold text-vermilion">
          ₩{formatKrw(total)} (VAT 포함)
        </span>
        {HEADER_LEFT_TAIL_FIELDS.map(({ key, label }) => (
          <HeaderInputRow
            key={key}
            label={label}
            value={header[key]}
            onChange={(v) => setField(key, v)}
          />
        ))}
      </div>

      {/* 우측: 발신자(상수) + 담당자 연락처 */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <SenderRow label="법인명" value={QUOTE_SENDER.company} />
        <SenderRow label="대표이사" value={QUOTE_SENDER.ceo} />
        <SenderRow label="등록번호" value={QUOTE_SENDER.bizNo} />
        <SenderRow label="주소" value={QUOTE_SENDER.address} />

        <span className="py-0.5 text-xs font-medium text-muted">담당자</span>
        <input
          aria-label="담당자"
          type="text"
          value={header.manager}
          onChange={(e) => setField("manager", e.target.value)}
          className="border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="담당자 입력"
        />
        <span className="py-0.5 text-xs font-medium text-muted">전화</span>
        <input
          aria-label="담당자 전화"
          type="text"
          value={header.managerTel}
          onChange={(e) => setField("managerTel", e.target.value)}
          className="border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="전화 입력"
        />
        <span className="py-0.5 text-xs font-medium text-muted">이메일</span>
        <input
          aria-label="담당자 이메일"
          type="text"
          value={header.managerEmail}
          onChange={(e) => setField("managerEmail", e.target.value)}
          className="border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="이메일 입력"
        />
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
    <div className="flex items-center gap-3 text-xs text-cream">
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
          className="w-14 border border-cream bg-transparent px-1 py-0.5 text-right text-cream outline-none focus:border-cream"
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
          className="w-14 border border-cream bg-transparent px-1 py-0.5 text-right text-cream outline-none focus:border-cream"
        />
      </label>
    </div>
  );
}

// ────────────── 섹션 표 ──────────────

/** system/outsource: amount 컬럼은 rowComputed 자동값(읽기전용). 그 외 simple: 직접입력. */
function isAutoAmount(section: QuoteSection): boolean {
  return section.id === "system" || section.id === "outsource";
}

function SectionTable({
  section,
  onSectionChange,
}: {
  section: QuoteSection;
  onSectionChange: (s: QuoteSection) => void;
}) {
  const isLabor = section.kind === "labor";
  const autoAmount = isAutoAmount(section);

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
                            aria-label={col.label}
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

                  // amount 컬럼
                  if (col.kind === "amount") {
                    const numVal = typeof raw === "number" ? raw : 0;
                    // system/outsource: 자동계산값 읽기전용 표시
                    if (autoAmount) {
                      return (
                        <td
                          key={col.key}
                          className="border border-line bg-washi-raised px-2 py-0.5 text-right text-xs text-muted"
                        >
                          {formatKrw(numVal)}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.key}
                        className="border border-line px-1 py-0.5 text-right"
                      >
                        <input
                          aria-label={col.label}
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
                  // number 컬럼 (수량·기간·단가 등)
                  if (col.kind === "number") {
                    const numVal = typeof raw === "number" ? raw : 0;
                    return (
                      <td
                        key={col.key}
                        className="border border-line px-1 py-0.5 text-right"
                      >
                        <input
                          aria-label={col.label}
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
                          aria-label={col.label}
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
                        aria-label={col.label}
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
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={addRow}
          className="border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream"
          aria-label="행 추가"
        >
          + 행 추가
        </button>
      </div>
      {isLabor && <LaborRollupBlock section={section} />}
    </div>
  );
}

// ────────────── 섹션(제목 + 표 + 문구) ──────────────

function SectionBlock({
  section,
  onSectionChange,
}: {
  section: QuoteSection;
  onSectionChange: (s: QuoteSection) => void;
}) {
  const isLabor = section.kind === "labor";

  return (
    <section className="border border-line bg-white">
      <div className="flex items-center justify-between bg-ink px-3 py-1.5">
        <h3 className="text-sm font-bold text-cream">{section.title}</h3>
        {isLabor && (
          <LaborRatesRow section={section} onSectionChange={onSectionChange} />
        )}
      </div>
      <div className="p-4">
        <SectionTable section={section} onSectionChange={onSectionChange} />
          <textarea
          rows={2}
          value={section.note}
          onChange={(e) => onSectionChange({ ...section, note: e.target.value })}
          className="mt-2 w-full resize-none border border-line-soft bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-ink"
          placeholder="이 항목 관련 문구/설명"
        />
      </div>
    </section>
  );
}

// ────────────── 안내사항(guide) ──────────────

function GuideEditor({
  guide,
  onGuideChange,
}: {
  guide: string[];
  onGuideChange: (guide: string[]) => void;
}) {
  function setLine(idx: number, value: string) {
    onGuideChange(guide.map((g, i) => (i === idx ? value : g)));
  }

  function addLine() {
    onGuideChange([...guide, ""]);
  }

  function deleteLine(idx: number) {
    onGuideChange(guide.filter((_, i) => i !== idx));
  }

  return (
    <div className="border-t border-ink pt-4">
      <p className="mb-2 text-sm font-bold text-ink">산출 근거 및 주의 안내사항</p>
      {guide.map((line, idx) => (
        <div key={idx} className="mb-1 flex items-center gap-2">
          <span className="text-xs text-muted">{idx + 1}.</span>
          <input
            type="text"
            value={line}
            onChange={(e) => setLine(idx, e.target.value)}
            className="flex-1 border-b border-line-soft bg-transparent py-0.5 text-sm text-ink outline-none focus:border-ink"
            placeholder="안내 내용 입력"
          />
          <button
            type="button"
            onClick={() => deleteLine(idx)}
            className="text-xs text-muted transition-colors hover:text-vermilion"
            aria-label="안내 삭제"
          >
            ×
          </button>
        </div>
      ))}
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={addLine}
          className="border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream"
        >
          + 안내 추가
        </button>
      </div>
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
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateDoc(next: QuoteDocument) {
    setDoc(recomputeDocument(next));
    setSaved(false);
    setDirty(true);
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
    // 머리말·약관·안내 보존
    updateDoc({ ...newDoc, header: doc.header, terms: doc.terms, guide: doc.guide });
    setCurrentQuoteType(newType);
  }

  function onHeaderChange(header: QuoteDocument["header"]) {
    updateDoc({ ...doc, header });
  }

  function onSectionChange(idx: number, section: QuoteSection) {
    const sections = doc.sections.map((s, i) => (i === idx ? section : s));
    updateDoc({ ...doc, sections });
  }

  function onGuideChange(guide: string[]) {
    updateDoc({ ...doc, guide });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const res = await onSave(id, doc, currentQuoteType);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setDirty(false);
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
            title={dirty && !saved ? "저장 후 최신 PDF가 반영됩니다" : undefined}
            onClick={(e) => {
              if (dirty && !saved && !window.confirm("저장하지 않은 변경은 PDF에 반영되지 않습니다. 계속할까요?")) {
                e.preventDefault();
              }
            }}
            className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            PDF
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-2">
        {/* A4 폭 문서 시트 */}
        <div className="mx-auto w-full max-w-[210mm] space-y-5 border border-line bg-white px-10 py-8">
          {/* 타이틀 + 구분선 */}
          <div className="border-b border-ink pb-2">
            <h1 className="text-center text-2xl font-bold text-ink">견적서</h1>
          </div>

          {/* 공통 헤더 2열 */}
          <DocumentHeader
            header={doc.header}
            total={doc.totals.total}
            onHeaderChange={onHeaderChange}
          />

          {/* 4섹션 */}
          <div className="space-y-4">
            {doc.sections.map((section, idx) => (
              <SectionBlock
                key={section.id}
                section={section}
                onSectionChange={(s) => onSectionChange(idx, s)}
              />
            ))}
          </div>

          {/* 안내사항 */}
          <GuideEditor guide={doc.guide} onGuideChange={onGuideChange} />

          {/* 합계 한글 표기 */}
          {doc.totals.total > 0 && (
            <p className="text-right text-xs text-muted">
              일금 {koreanAmount(doc.totals.total)}원 정 (VAT 포함)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
