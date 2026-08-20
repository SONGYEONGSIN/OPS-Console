import { excelSerialToIso, isoToExcelSerial } from "@/lib/excel-date";

export { excelSerialToIso, isoToExcelSerial };

/**
 * 등기관리대장(`2026년도 우편물 발송.xlsx`) 해석.
 *
 * 화면의 주인공은 **대장**이고 영수증은 증빙이다. 이 파일은 Graph가 준 raw 값 배열을
 * 행으로 바꾸는 순수 함수만 둔다 — 날짜 환산과 헤더 대조를 테스트할 수 있어야 한다.
 */

/** 대장의 열 순서. 이 순서가 곧 의미라, 어긋나면 엉뚱한 칸을 읽는다. */
export const LEDGER_HEADERS = [
  "순번",
  "발송일",
  "수신처",
  "수신자",
  "담당자",
  "확인",
  "등기번호",
  "비고",
] as const;

export type LedgerRow = {
  seq: number | null;
  /** ISO 날짜(YYYY-MM-DD). 엑셀은 일련번호로 들고 있다. */
  sentOn: string;
  recipientOrg: string;
  recipientName: string;
  assignee: string;
  confirmedBy: string;
  trackingNo: string;
  note: string;
};

/**
 * 그 해의 시트 이름.
 *
 * 시트 이름에 연도가 박혀 있어 **내년 4월이면 새 시트가 생긴다.** 이름을 코드에
 * 박아두면 그때 조용히 엉뚱한 시트에 쓰게 되므로, 읽는 쪽에서 대조한다.
 */
export function expectedSheetName(year: number): string {
  return `${year}년도 우편물발송(04월~)`;
}

export function parseLedgerRows(values: unknown[][]): LedgerRow[] {
  const header = (values[0] ?? []).map((c) => String(c ?? "").trim());
  const expected = [...LEDGER_HEADERS];
  if (header.length < expected.length) {
    throw new Error(`대장 헤더가 짧습니다: ${header.join("·")}`);
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (header[i] !== expected[i]) {
      throw new Error(
        `대장 열 순서가 다릅니다 — ${i + 1}번째가 "${header[i]}" (기대: "${expected[i]}")`,
      );
    }
  }

  const out: LedgerRow[] = [];
  for (const raw of values.slice(1)) {
    const cell = (i: number) => String(raw[i] ?? "").trim();
    // 엑셀 끝의 빈 줄이 유령 행이 된다. 발송일과 수신처가 둘 다 비면 행이 아니다.
    if (!cell(1) && !cell(2)) continue;
    const seqRaw = raw[0];
    out.push({
      seq: typeof seqRaw === "number" ? seqRaw : null,
      sentOn: excelSerialToIso(
        typeof raw[1] === "number" ? raw[1] : String(raw[1] ?? ""),
      ),
      recipientOrg: cell(2),
      recipientName: cell(3),
      assignee: cell(4),
      confirmedBy: cell(5),
      // 사람이 채우다 만 행도 대장의 사실이다 — 비었다고 버리지 않는다.
      trackingNo: cell(6),
      note: cell(7),
    });
  }
  return out;
}
