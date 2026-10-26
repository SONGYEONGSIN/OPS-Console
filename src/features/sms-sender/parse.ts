import { DOC_KINDS, HIDDEN_SHEETS } from "./types";
import type {
  CheckItem,
  Completeness,
  DocKind,
  DocStatus,
  HiddenSheetKey,
  SchoolRow,
  SenderNumber,
} from "./types";

export class SheetShapeError extends Error {
  readonly sheet: string;
  readonly column: string;
  constructor(message: string, sheet: string, column: string) {
    super(message);
    this.name = "SheetShapeError";
    this.sheet = sheet;
    this.column = column;
  }
}

/** 첫 줄만 남기고 끝 괄호(기준일 등)를 버린다. */
export function normalizeHeader(h: unknown): string {
  const first = String(h ?? "").split("\n")[0];
  return first
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function excelDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()))
    return v.trim();
  return null;
}

export function digitsOf(s: string): string {
  return s.replace(/\D/g, "");
}

const text = (v: unknown): string => String(v ?? "").trim();
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Table = { index: Record<string, number>; rows: unknown[][] };

function readTable(
  key: HiddenSheetKey,
  values: unknown[][],
  required: readonly string[],
): Table {
  const sheet = HIDDEN_SHEETS[key];
  if (values.length === 0)
    throw new SheetShapeError(`‘${sheet}’ 시트가 비어 있습니다.`, sheet, "");
  const heads = values[0].map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const name of required) {
    const hits = heads.flatMap((h, i) => (h === name ? [i] : []));
    if (hits.length === 0)
      throw new SheetShapeError(
        `‘${sheet}’ 시트에서 ‘${name}’ 열을 찾지 못했습니다.`,
        sheet,
        name,
      );
    if (hits.length > 1)
      throw new SheetShapeError(
        `‘${sheet}’ 시트에 ‘${name}’ 열이 두 개 있습니다.`,
        sheet,
        name,
      );
    index[name] = hits[0];
  }
  const noAt = index["No"];
  const rows = values.slice(1).filter((r) => {
    const v = r[noAt];
    return v !== "" && v !== null && v !== undefined;
  });
  return { index, rows };
}

const SCHOOL_COLUMNS = [
  "No",
  "학교명",
  "구분",
  "원서접수",
  "PIMS",
  "등록 회선",
  "일괄 등록",
  "추가 등록",
  "서류 미비",
  "최근 등록일",
  "제출 서류",
  "확인",
  "비고",
] as const;
const DOC_COLUMNS = [
  "No",
  "학교명",
  "세종 등록 상태",
  ...DOC_KINDS,
  "제출 상태",
  "미제출 서류",
] as const;
const NUMBER_COLUMNS = [
  "No",
  "학교명",
  "구분",
  "발신번호",
  "상태",
  "등록일자",
  "제출 서류",
  "비고",
] as const;
const CHECK_COLUMNS = ["No", "유형", "대상", "내용", "근거", "할 일"] as const;

export function parseSchools(values: unknown[][]): SchoolRow[] {
  const { index: c, rows } = readTable("schools", values, SCHOOL_COLUMNS);
  return rows.map((r) => ({
    no: num(r[c["No"]]),
    name: text(r[c["학교명"]]),
    gubun: text(r[c["구분"]]),
    apply: text(r[c["원서접수"]]) === "O",
    pims: text(r[c["PIMS"]]) === "O",
    lines: num(r[c["등록 회선"]]),
    bulk: num(r[c["일괄 등록"]]),
    added: num(r[c["추가 등록"]]),
    deficient: num(r[c["서류 미비"]]),
    lastRegisteredAt: excelDate(r[c["최근 등록일"]]),
    docSummary: text(r[c["제출 서류"]]),
    needsCheck: text(r[c["확인"]]) === "확인 필요",
    note: text(r[c["비고"]]),
  }));
}

function completenessOf(state: string): Completeness {
  if (state === "모두 제출") return "완비";
  return /미제출/.test(state) ? "미비" : "확인 안 됨";
}

export function parseDocs(values: unknown[][]): Map<number, DocStatus> {
  const { index: c, rows } = readTable("docs", values, DOC_COLUMNS);
  const out = new Map<number, DocStatus>();
  for (const r of rows) {
    const marks = Object.fromEntries(
      DOC_KINDS.map((k) => [k, text(r[c[k]])]),
    ) as Record<DocKind, string>;
    const submitState = text(r[c["제출 상태"]]);
    out.set(num(r[c["No"]]), {
      sejongStatus: text(r[c["세종 등록 상태"]]),
      marks,
      submitState,
      completeness: completenessOf(submitState),
      missing: text(r[c["미제출 서류"]]),
    });
  }
  return out;
}

export function parseNumbers(
  values: unknown[][],
): Omit<SenderNumber, "schoolNo">[] {
  const { index: c, rows } = readTable("numbers", values, NUMBER_COLUMNS);
  return rows.map((r) => {
    const number = text(r[c["발신번호"]]);
    return {
      no: num(r[c["No"]]),
      school: text(r[c["학교명"]]),
      gubun: text(r[c["구분"]]),
      number,
      digits: digitsOf(number),
      status: text(r[c["상태"]]),
      registeredAt: excelDate(r[c["등록일자"]]),
      docs: text(r[c["제출 서류"]]),
      note: text(r[c["비고"]]),
    };
  });
}

export function parseChecks(
  values: unknown[][],
): Omit<CheckItem, "schoolNo">[] {
  const { index: c, rows } = readTable("checks", values, CHECK_COLUMNS);
  return rows.map((r) => ({
    no: num(r[c["No"]]),
    kind: text(r[c["유형"]]),
    target: text(r[c["대상"]]),
    content: text(r[c["내용"]]),
    basis: text(r[c["근거"]]),
    todo: text(r[c["할 일"]]),
  }));
}
