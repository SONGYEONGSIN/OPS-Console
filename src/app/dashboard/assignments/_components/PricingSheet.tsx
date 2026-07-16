"use client";

import { useState } from "react";
import type {
  PricingSheetParsed,
  PricingSection,
  PricingCategory,
} from "@/features/assignments/pricing-parse";

const CATEGORY_ORDER: PricingCategory[] = ["원서접수", "PIMS", "입학상담앱"];

/**
 * 헤더 row의 빈 셀을 직전 비어있지 않은 셀의 colspan으로 흡수.
 * 엑셀의 가로 셀 병합(예: PIMS '구분'이 col 11+12 병합)이 plain text 변환 시
 * 빈 셀로 나타나는 케이스 처리.
 */
function computeHeaderCells(
  headerRow: string[],
): { value: string; colspan: number }[] {
  const out: { value: string; colspan: number }[] = [];
  for (const cell of headerRow) {
    if (cell.trim() === "" && out.length > 0) {
      out[out.length - 1].colspan += 1;
    } else {
      out.push({ value: cell, colspan: 1 });
    }
  }
  return out;
}

type BodyCell = {
  value: string;
  colspan: number;
  rowspan: number;
  /** true면 렌더 skip (rowspan/colspan으로 흡수됨) */
  skip: boolean;
  /** rowspan/colspan으로 묶인 cell — 수직 가운데 + 수평 가운데 정렬 */
  centered: boolean;
};

const isFilled = (c: string | undefined) => (c ?? "").trim() !== "";

/**
 * 본문 행 colspan 계산 — 첫 cell + 마지막 cell만 채워지고 중간 모두 빈 패턴
 * (예: PIMS '수수료(건당) ... 2,000원')은 첫 cell colspan으로 흡수.
 */
function applyRowColspan(row: string[]): BodyCell[] {
  const base: BodyCell[] = row.map((c) => ({
    value: c,
    colspan: 1,
    rowspan: 1,
    skip: false,
    centered: false,
  }));
  const firstFilled = row.findIndex(isFilled);
  const lastFilled = row.length - 1 - [...row].reverse().findIndex(isFilled);
  if (firstFilled < 0 || firstFilled === lastFilled) return base;
  const middleAllEmpty = row
    .slice(firstFilled + 1, lastFilled)
    .every((c) => !isFilled(c));
  if (middleAllEmpty && firstFilled === 0 && lastFilled - firstFilled >= 2) {
    base[firstFilled].colspan = lastFilled - firstFilled;
    base[firstFilled].centered = true;
    for (let i = firstFilled + 1; i < lastFilled; i++) base[i].skip = true;
  }
  return base;
}

/**
 * 본문 전체 cell matrix 계산 — colspan(행 단위) + rowspan(열 단위, 같은 col에
 * 연속된 빈 cell을 직전 비-빈 cell의 rowspan으로 흡수). 엑셀 세로 셀 병합
 * (예: '신용카드/계좌이체/가상계좌'가 5행 vertical merge) 표현.
 */
function computeBodyMatrix(rows: string[][]): BodyCell[][] {
  const matrix = rows.map(applyRowColspan);
  const colCount = Math.max(0, ...matrix.map((r) => r.length));
  for (let c = 0; c < colCount; c++) {
    for (let r = 0; r < matrix.length; r++) {
      const cell = matrix[r][c];
      if (!cell || cell.skip || !isFilled(cell.value)) continue;
      let span = 1;
      for (let r2 = r + 1; r2 < matrix.length; r2++) {
        const below = matrix[r2][c];
        if (!below || below.skip || isFilled(below.value)) break;
        below.skip = true;
        span += 1;
      }
      if (span > 1) {
        cell.rowspan = span;
        cell.centered = true;
      }
    }
  }
  return matrix;
}

/**
 * 본문 첫 행이 sub-header 패턴(col 0 빈, 다른 본문 행은 col 0 값 있음)이면
 * 헤더의 빈 cell을 sub-header 값으로 채워서 단일 헤더로 평탄화.
 * '서비스 제공 기준' 표의 ["서비스 구분", "부가서비스 제공기준"(8 cols), "비고"]
 * + ["", "기본접수", ..., "성적산출"] 구조를 처리.
 */
function mergeSubHeader(
  headerRow: string[] | undefined,
  bodyRows: string[][],
): { headerRow: string[] | undefined; bodyRows: string[][] } {
  if (!headerRow || bodyRows.length < 2) return { headerRow, bodyRows };
  const candidate = bodyRows[0];
  const isSubHeader =
    (candidate[0] ?? "").trim() === "" &&
    candidate.slice(1).some((c) => c.trim() !== "") &&
    bodyRows.slice(1).every((r) => (r[0] ?? "").trim() !== "");
  if (!isSubHeader) return { headerRow, bodyRows };
  // sub-header가 있는 cell은 sub로 덮어씀 (그룹 라벨이 sub-header로 평탄화),
  // sub가 빈 cell은 헤더 원래 값 유지 (좌·우 끝 rowspan label 같은 경우).
  const length = Math.max(headerRow.length, candidate.length);
  const merged = Array.from({ length }, (_, i) => {
    const sub = (candidate[i] ?? "").trim();
    return sub !== "" ? candidate[i]! : (headerRow[i] ?? "");
  });
  return { headerRow: merged, bodyRows: bodyRows.slice(1) };
}

/**
 * 첫 행이 헤더처럼 보이는지 휴리스틱 — 짧은 라벨(평균 ≤ 15자) + 멀티라인 없음.
 * '전문대학 신규서비스 개발비 정책'처럼 첫 행이 긴 설명문/데이터인 경우 false.
 */
function looksLikeHeader(row: string[]): boolean {
  const filled = row.filter((c) => c.trim() !== "");
  if (filled.length === 0) return false;
  if (filled.some((c) => c.includes("\n"))) return false;
  const avg = filled.reduce((a, c) => a + c.trim().length, 0) / filled.length;
  return avg <= 15;
}

function SectionCard({ section }: { section: PricingSection }) {
  const [rawHeader, ...rawBody] = section.rows;
  const useAsHeader = rawHeader ? looksLikeHeader(rawHeader) : false;
  const { headerRow, bodyRows } = useAsHeader
    ? mergeSubHeader(rawHeader!, rawBody)
    : { headerRow: undefined, bodyRows: section.rows };
  const headerCells = headerRow ? computeHeaderCells(headerRow) : [];
  // 본문 행을 헤더 col 수에 맞춰 padding — trimTrailing으로 행마다 cell 수가
  // 달라져 border가 어긋나는 문제 회피. 헤더 없으면 본문 max length 기준.
  const headerColCount = headerRow
    ? headerRow.length
    : Math.max(0, ...bodyRows.map((r) => r.length));
  const paddedBody = bodyRows.map((r) => {
    if (r.length >= headerColCount) return r;
    return [...r, ...Array(headerColCount - r.length).fill("")];
  });
  const bodyMatrix = computeBodyMatrix(paddedBody);

  return (
    <article className="border border-line-soft bg-situation-bg">
      <header className="border-b border-line-soft bg-search-field-bg px-5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold text-ink">
            {section.title || "(섹션)"}
          </h3>
          {section.subtitle ? (
            <p className="text-xs text-muted">{section.subtitle}</p>
          ) : null}
        </div>
      </header>

      {section.rows.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            {headerCells.length > 0 ? (
              <thead>
                <tr className="border-b-2 border-ink/20 bg-search-field-bg">
                  {headerCells.map((c, i) => (
                    <th
                      key={i}
                      colSpan={c.colspan}
                      className={`border-r border-line-soft px-3 py-2 text-center align-top font-semibold text-ink last:border-r-0 ${
                        i === 0 ? "w-[20%]" : ""
                      }`}
                    >
                      {c.value}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            {bodyMatrix.length > 0 ? (
              <tbody>
                {bodyMatrix.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-line-soft last:border-b-0"
                  >
                    {row.map((c, ci) => {
                      if (c.skip) return null;
                      // 첫 컬럼 폭을 카드 전체에 통일 (table-fixed + w-[20%]).
                      // thead 없는 카드도 tbody 첫 행이 컬럼 width를 결정.
                      const firstColWidth = ci === 0 ? "w-[20%]" : "";
                      return (
                        <td
                          key={ci}
                          colSpan={c.colspan}
                          rowSpan={c.rowspan}
                          className={`border-r border-line-soft px-3 py-2 whitespace-pre-wrap text-ink last:border-r-0 ${firstColWidth} ${
                            c.centered
                              ? "text-center align-middle font-medium"
                              : `align-top ${ci === 0 ? "font-medium" : ""}`
                          }`}
                        >
                          {c.value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ) : null}
          </table>
        </div>
      ) : null}

      {section.notes.length > 0 ? (
        <footer className="space-y-1 border-t border-line-soft bg-search-field-bg px-5 py-3">
          {section.notes.map((n, i) => (
            <p
              key={i}
              className="block whitespace-pre-wrap text-xs leading-relaxed text-vermilion"
            >
              {n}
            </p>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

function CategoryButtons({
  active,
  counts,
  onChange,
}: {
  active: PricingCategory;
  counts: Record<PricingCategory, number>;
  onChange: (next: PricingCategory) => void;
}) {
  // ListPattern '+ 신규 서비스' 버튼 디자인 차용 (px-3 py-1 text-xs font-medium)
  // active: vermilion 가득 / inactive: outline.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const isActive = cat === active;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            className={`cursor-pointer border px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "border-vermilion bg-vermilion text-cream hover:bg-vermilion-deep"
                : "border-line bg-paper text-ink hover:bg-line-soft"
            }`}
          >
            {cat}
            <span
              className={`ml-1.5 tabular-nums ${
                isActive ? "text-cream/80" : "text-muted"
              }`}
            >
              ({counts[cat]})
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * (참고) 가격정책 시트를 3 카테고리 탭(원서접수/PIMS/입학상담앱)으로 분기 렌더.
 * 활성 탭의 섹션만 페이지 전체 폭 단일 컬럼으로 카드 stack 표시.
 * 시트 좌·중(col 0~9)이 원서접수 12 섹션, 우(col 11~14)가 PIMS·입학상담앱.
 */
export function PricingSheet({ parsed }: { parsed: PricingSheetParsed }) {
  const counts: Record<PricingCategory, number> = {
    원서접수: parsed.원서접수.length,
    PIMS: parsed.PIMS.length,
    입학상담앱: parsed.입학상담앱.length,
  };
  const total = counts.원서접수 + counts.PIMS + counts.입학상담앱;

  const initialActive = CATEGORY_ORDER.find((c) => counts[c] > 0) ?? "원서접수";
  const [active, setActive] = useState<PricingCategory>(initialActive);

  if (total === 0) {
    return (
      <section className="p-7">
        <div className="border border-line-soft bg-situation-bg p-8 text-center">
          <p className="text-sm text-muted">가격정책 데이터가 없습니다.</p>
        </div>
      </section>
    );
  }

  const sections = parsed[active];

  return (
    <>
      <div className="flex justify-end px-7 pt-3">
        <CategoryButtons active={active} counts={counts} onChange={setActive} />
      </div>
      <section className="px-7 pb-7 pt-3">
        <div className="space-y-5">
          {sections.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {active} 카테고리에 표시할 섹션이 없습니다.
            </p>
          ) : (
            sections.map((s, i) => <SectionCard key={i} section={s} />)
          )}
        </div>
      </section>
    </>
  );
}
