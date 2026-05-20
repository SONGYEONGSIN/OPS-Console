import type { ListRow } from "../_components/patterns/ListPattern";
import type { ReceivablesSheet } from "@/features/receivables/queries";

/** 시트 헤더에서 도메인 컬럼 위치 찾기 (한국어 키워드 매칭) */
export function pickReceivablesColumns(headers: string[]): {
  date: number;
  name: number;
  detail: number;
  amount: number;
  status: number;
  owner: number;
  remarks: number;
  dueDate: number;
  schoolOwner: number;
} {
  const find = (regex: RegExp) => headers.findIndex((h) => regex.test(h));
  const schoolOwner = find(/^학교\s*담당자?$|^학교\s*담당\s*이메일$/);
  let owner = find(/운영자|담당/);
  if (owner === schoolOwner) owner = find(/^운영자$/);
  return {
    date: find(/^청구일자|^청구\s*일자/),
    name: find(/거래처|학교|이름/),
    detail: find(/내역|상세/),
    amount: find(/청구금액|금액/),
    status: find(/입금여부|여부|상태/),
    owner,
    remarks: find(/적요|비고|메모|피드백/),
    dueDate: find(/입금예정일|예정일/),
    schoolOwner,
  };
}

/** 합계/소계 행 필터 휴리스틱 */
const SUMMARY_RE =
  /^\s*(소\s*계|합\s*계|총\s*계|부분\s*합|누\s*계|총합|합산)/;

export function isReceivablesDataRow(row: ListRow): boolean {
  const cells = row.receivablesCells?.textValues ?? [];
  for (const c of cells) {
    if (SUMMARY_RE.test(String(c ?? ""))) return false;
  }
  const date = (row.meta ?? "").trim();
  if (date === "") return false;
  return true;
}

export function receivablesToListRow(
  sheet: ReceivablesSheet,
  idx: number,
): ListRow {
  const cols = pickReceivablesColumns(sheet.headers);
  const textRow = sheet.rowsText[idx] ?? [];
  const valuesRow = sheet.rows[idx] ?? [];
  const get = (ci: number) =>
    ci >= 0 ? textRow[ci] ?? String(valuesRow[ci] ?? "") : "";
  const statusText = get(cols.status);
  const remarksText = get(cols.remarks);
  const isPaid =
    /입금\s*완료/.test(remarksText) ||
    (/수금|완료|입금/.test(statusText) && !/미수|미입금/.test(statusText));

  return {
    id: `r-${idx}`,
    name: get(cols.name),
    body: get(cols.detail),
    status: isPaid ? "approved" : "active",
    owner: get(cols.owner),
    author: get(cols.amount),
    meta: get(cols.date),
    receivablesCells: {
      headers: sheet.headers,
      textValues: sheet.headers.map((_, i) =>
        textRow[i] !== undefined && textRow[i] !== ""
          ? textRow[i]
          : String(valuesRow[i] ?? ""),
      ),
      sheetRowNumber: sheet.headerRowNumber + idx + 1,
      remarksColIdx:
        cols.remarks >= 0 ? sheet.validColIdx[cols.remarks] : undefined,
      remarksHeaderIdx: cols.remarks >= 0 ? cols.remarks : undefined,
      remarks: cols.remarks >= 0 ? textRow[cols.remarks] ?? "" : "",
      dueDateColIdx:
        cols.dueDate >= 0 ? sheet.validColIdx[cols.dueDate] : undefined,
      dueDateHeaderIdx: cols.dueDate >= 0 ? cols.dueDate : undefined,
      dueDate: cols.dueDate >= 0 ? textRow[cols.dueDate] ?? "" : "",
      schoolOwnerColIdx:
        cols.schoolOwner >= 0 ? sheet.validColIdx[cols.schoolOwner] : undefined,
      schoolOwnerHeaderIdx:
        cols.schoolOwner >= 0 ? cols.schoolOwner : undefined,
      schoolOwner:
        cols.schoolOwner >= 0 ? textRow[cols.schoolOwner] ?? "" : "",
      worksheetName: sheet.worksheetName,
    },
  };
}
