import "server-only";
import ExcelJS from "exceljs";
import {
  nextWeekSheetname,
  weekDateRange,
  formatDateRange,
  subWeekText,
  subDateRange,
  rollWeek,
} from "./rollover-logic";

/**
 * 워크북 버퍼를 받아 차주 시트를 서식 포함 복제하고 B2/B3/C3 날짜를 갱신한다.
 * Microsoft Graph Excel API에는 worksheet copy 액션이 없어, 파일을 다운로드한 뒤
 * exceljs로 로컬 편집한다 (docs/buseobogo.py copy_excel_sheet_with_next_week 이식).
 */

export type RolloverInput = {
  /** 원본 .xlsx 파일 바이트. */
  buffer: ArrayBuffer;
  /** 소스 시트 선택 정규식 (예: /\d{4}년\s*\d+월\s*\d+주차/). */
  sheetRe: RegExp;
  /** 차주 날짜 계산용 — 차주 파일의 연/월/주차. */
  year: number;
  month: number;
  week: number;
};

export type RolloverResult = {
  // exceljs writeBuffer 반환(Buffer extends ArrayBuffer) — ArrayBuffer로 노출.
  buffer: ArrayBuffer;
  newSheet: string;
  sourceSheet: string;
};

/** 셀 값 + 스타일을 source → target 시트로 복제 (값, font/fill/border/alignment/numFmt). */
function copyCells(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet): void {
  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const out = target.getCell(rowNumber, colNumber);
      if (cell.value !== null && cell.value !== undefined) {
        out.value = cell.value;
      }
      // exceljs의 cell.style는 font/fill/border/alignment/numFmt/protection 묶음.
      out.style = cell.style;
    });
  });
}

/** 병합 셀 범위 복제. */
function copyMerges(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
): void {
  for (const range of source.model.merges) {
    target.mergeCells(range);
  }
}

/** 행 높이 / 열 너비 복제. */
function copyDimensions(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
): void {
  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (typeof row.height === "number") {
      target.getRow(rowNumber).height = row.height;
    }
  });
  for (let c = 1; c <= source.columnCount; c++) {
    const width = source.getColumn(c).width;
    if (typeof width === "number") {
      target.getColumn(c).width = width;
    }
  }
}

/** B2(주차 텍스트) / B3(이번 주차) / C3(다음 주차) 날짜 갱신. */
function updateDateCells(
  ws: ExcelJS.Worksheet,
  newSheet: string,
  thisRange: string,
  nextRange: string,
): void {
  ws.getCell("B2").value = subWeekText(ws.getCell("B2").text, newSheet);
  ws.getCell("B3").value = subDateRange(ws.getCell("B3").text, thisRange);
  ws.getCell("C3").value = subDateRange(ws.getCell("C3").text, nextRange);
}

export async function rolloverWorkbookBuffer(
  input: RolloverInput,
): Promise<RolloverResult> {
  const { buffer, sheetRe, year, month, week } = input;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // 소스 시트 = sheetRe 매치 첫 시트, 없으면 첫 시트.
  const sourceSheet =
    workbook.worksheets.find((w) => sheetRe.test(w.name))?.name ??
    workbook.worksheets[0]?.name;
  if (!sourceSheet) {
    throw new Error("[weekly-report] rollover: 시트가 없습니다");
  }
  const source = workbook.getWorksheet(sourceSheet);
  if (!source) {
    throw new Error(`[weekly-report] rollover: 소스 시트 없음 ${sourceSheet}`);
  }

  // 날짜 — 이번 주차(B3) / 다음 주차(C3). "M/D~M/D" 패턴만 치환.
  const thisWk = weekDateRange(year, month, week);
  const thisRange = formatDateRange(thisWk.monday, thisWk.friday);
  const nx = rollWeek(year, month, week);
  const nextWk = weekDateRange(nx.year, nx.month, nx.week);
  const nextRange = formatDateRange(nextWk.monday, nextWk.friday);

  const newSheet = nextWeekSheetname(sourceSheet);

  if (newSheet === sourceSheet) {
    // 시트명이 주차 패턴이 아니면 복제 없이 소스 시트에 직접 갱신.
    updateDateCells(source, newSheet, thisRange, nextRange);
  } else {
    const target = workbook.addWorksheet(newSheet);
    copyCells(source, target);
    copyMerges(source, target);
    copyDimensions(source, target);
    updateDateCells(target, newSheet, thisRange, nextRange);
    // 새 시트를 맨 앞으로 (docs/buseobogo.py move_sheet offset). exceljs는
    // orderNo로 시트 순서를 정하지만 d.ts에 누락 — 런타임 속성을 좁은 타입으로 접근.
    const orderOf = (w: ExcelJS.Worksheet) =>
      (w as unknown as { orderNo: number }).orderNo;
    const minOrder = Math.min(
      ...workbook.worksheets.filter((w) => w.name !== newSheet).map(orderOf),
    );
    (target as unknown as { orderNo: number }).orderNo = minOrder - 1;

    // 열 때 새 시트가 기본 선택되도록 — 이전 시트에 tabSelected가 남으면
    // 사용자가 이전 주차 시트에 잘못 작성하게 된다. tabSelected는 exceljs
    // 런타임 지원이나 d.ts에 누락 — 좁은 타입으로 접근.
    for (const w of workbook.worksheets) {
      const selected = w.name === newSheet;
      if ((!w.views || w.views.length === 0) && selected) {
        w.views = [{} as ExcelJS.WorksheetView];
      }
      for (const v of w.views ?? []) {
        (v as unknown as { tabSelected?: boolean }).tabSelected = selected;
      }
    }
    // 새 시트는 orderNo 최소값이라 기록 순서상 첫 탭 → activeTab 0.
    const baseView = workbook.views?.[0] ?? {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      visibility: "visible" as const,
    };
    workbook.views = [{ ...baseView, firstSheet: 0, activeTab: 0 }];
  }

  const out = await workbook.xlsx.writeBuffer();
  return { buffer: out, newSheet, sourceSheet };
}
