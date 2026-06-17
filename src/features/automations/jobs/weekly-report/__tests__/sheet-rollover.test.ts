import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { rolloverWorkbookBuffer } from "../sheet-rollover";

const SHEET_RE = /\d{4}년\s*\d+월\s*\d+주차/;

/** 소스 시트(2026년 1월 3주차) + B2/B3/C3 + 병합/스타일/치수를 갖춘 워크북 버퍼 생성. */
async function makeSourceBuffer(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  // 최신 주차 시트가 맨 앞(production은 새 시트를 front로 이동) → 첫 매칭이 소스.
  const ws = wb.addWorksheet("2026년 1월 3주차");
  const prev = wb.addWorksheet("2026년 1월 2주차"); // 이전 주차(보존 검증용)
  prev.getCell("A1").value = "이전주차";
  ws.getCell("B2").value = "주간 업무보고 2026년 1월 3주차";
  ws.getCell("B3").value = "기간 1/12~1/16";
  ws.getCell("C3").value = "차주 1/19~1/23";
  // 스타일 + 병합 + 치수
  ws.getCell("B2").font = { bold: true, size: 14 };
  ws.getCell("B2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFF0000" },
  };
  ws.mergeCells("B2:D2");
  ws.getRow(2).height = 30;
  ws.getColumn(2).width = 25;
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("rolloverWorkbookBuffer", () => {
  it("차주 시트 생성 + 원본 보존 + B2/B3/C3 갱신 + 병합/스타일/치수 복제", async () => {
    const buffer = await makeSourceBuffer();
    const out = await rolloverWorkbookBuffer({
      buffer,
      sheetRe: SHEET_RE,
      year: 2026,
      month: 1,
      week: 4,
    });

    expect(out.sourceSheet).toBe("2026년 1월 3주차");
    expect(out.newSheet).toBe("2026년 1월 4주차");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.buffer);
    const names = wb.worksheets.map((w) => w.name);
    // (1) 차주 시트 생성 + (2) 원본/이전 주차 보존
    expect(names).toContain("2026년 1월 4주차");
    expect(names).toContain("2026년 1월 3주차");
    expect(names).toContain("2026년 1월 2주차");

    const next = wb.getWorksheet("2026년 1월 4주차");
    if (!next) throw new Error("차주 시트 없음");
    // (3) B2: 주차 텍스트 치환 / B3: 이번 주차 / C3: 다음 주차
    expect(next.getCell("B2").text).toContain("2026년 1월 4주차");
    expect(next.getCell("B3").text).toBe("기간 1/19~1/23");
    expect(next.getCell("C3").text).toBe("차주 1/26~1/30");
    // (4) 병합/스타일/치수 복제
    expect(next.model.merges).toContain("B2:D2");
    expect(next.getCell("B2").font).toMatchObject({ bold: true, size: 14 });
    expect(next.getCell("B2").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
    });
    expect(next.getRow(2).height).toBe(30);
    expect(next.getColumn(2).width).toBe(25);

    // 원본 시트는 그대로
    const src = wb.getWorksheet("2026년 1월 3주차");
    if (!src) throw new Error("원본 시트 없음");
    expect(src.getCell("B2").text).toContain("2026년 1월 3주차");
    expect(src.getCell("B3").text).toBe("기간 1/12~1/16");
  });

  it("차주 시트를 맨 앞으로 이동", async () => {
    const buffer = await makeSourceBuffer();
    const out = await rolloverWorkbookBuffer({
      buffer,
      sheetRe: SHEET_RE,
      year: 2026,
      month: 1,
      week: 4,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.buffer);
    expect(wb.worksheets[0].name).toBe("2026년 1월 4주차");
  });

  it("newSheet === sourceSheet 면 복제 없이 소스 시트에 직접 날짜 갱신", async () => {
    // 시트명이 주차 패턴이 아니면 nextWeekSheetname이 그대로 반환 → 복제 생략
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("고정시트");
    ws.getCell("B2").value = "헤더 2026년 1월 3주차";
    ws.getCell("B3").value = "기간 1/12~1/16";
    ws.getCell("C3").value = "차주 1/19~1/23";
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const out = await rolloverWorkbookBuffer({
      buffer,
      sheetRe: SHEET_RE,
      year: 2026,
      month: 1,
      week: 4,
    });
    expect(out.sourceSheet).toBe("고정시트");
    expect(out.newSheet).toBe("고정시트");

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(out.buffer);
    expect(wb2.worksheets.map((w) => w.name)).toEqual(["고정시트"]);
    const ws2 = wb2.getWorksheet("고정시트");
    if (!ws2) throw new Error("시트 없음");
    expect(ws2.getCell("B3").text).toBe("기간 1/19~1/23");
    expect(ws2.getCell("C3").text).toBe("차주 1/26~1/30");
  });

  it("sheetRe 매치 없으면 첫 시트를 소스로 사용", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("첫번째");
    a.getCell("B2").value = "헤더 2026년 1월 3주차";
    a.getCell("B3").value = "1/12~1/16";
    a.getCell("C3").value = "1/19~1/23";
    wb.addWorksheet("두번째");
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const out = await rolloverWorkbookBuffer({
      buffer,
      sheetRe: SHEET_RE,
      year: 2026,
      month: 1,
      week: 4,
    });
    expect(out.sourceSheet).toBe("첫번째");
  });
});
