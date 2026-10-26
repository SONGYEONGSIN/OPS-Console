import { canonicalSchoolName } from "./aliases";
import { DOC_KINDS, HIDDEN_SHEETS } from "./types";
import type {
  CheckItem,
  Completeness,
  DocKind,
  DocStatus,
  DriveFile,
  HiddenSheetKey,
  PdfCopy,
  RawPdf,
  RawSource,
  School,
  SchoolRow,
  SenderNumber,
  SmsSenderData,
  Stage,
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

export function pickLatestWorkbook(files: readonly DriveFile[]): {
  latest: DriveFile | null;
  offRuleFiles: string[];
} {
  const dated: { file: DriveFile; stamp: string }[] = [];
  const offRuleFiles: string[] = [];
  for (const file of files) {
    if (!/\.xlsm$/i.test(file.name)) continue;
    const m = /_(\d{6})\.xlsm$/.exec(file.name);
    if (m) dated.push({ file, stamp: m[1] });
    else offRuleFiles.push(file.name);
  }
  dated.sort(
    (a, b) =>
      b.stamp.localeCompare(a.stamp) ||
      b.file.lastModifiedDateTime.localeCompare(a.file.lastModifiedDateTime),
  );
  return { latest: dated[0]?.file ?? null, offRuleFiles };
}

const PDF_NAME = /^\((.+)\) SMS 발신용 대학 전화번호 등록 서류\.pdf$/i;

export function pdfSchoolName(fileName: string): string | null {
  return PDF_NAME.exec(fileName)?.[1] ?? null;
}

export function stageOf(folder: string): { stage: Stage; sub: string | null } {
  const parts = folder.split("/").filter(Boolean);
  if (parts[0] === "완료" && parts[1] === "제출완료") {
    const sub = parts.slice(2).join("/");
    return { stage: "제출완료", sub: sub || null };
  }
  if (parts[0] === "완료" && parts[1] === "검토완료")
    return { stage: "검토완료", sub: null };
  if (parts[0] === "진행 중") return { stage: "진행 중", sub: null };
  return { stage: "기타", sub: null };
}

const STAGE_RANK: Record<Stage, number> = {
  제출완료: 3,
  검토완료: 2,
  "진행 중": 1,
  기타: 0,
};

function toPdfCopy(p: RawPdf): PdfCopy {
  return {
    fileName: p.name,
    folder: p.folder,
    ...stageOf(p.folder),
    webUrl: p.webUrl,
    lastModifiedDateTime: p.lastModifiedDateTime,
  };
}

const byRankThenRecent = (a: PdfCopy, b: PdfCopy) =>
  STAGE_RANK[b.stage] - STAGE_RANK[a.stage] ||
  b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime);

/** 확인 항목 첫 줄 → 학교 No. 그 이름의 학교가 정확히 한 행일 때만 잇는다. */
function schoolNoOfTarget(
  target: string,
  byName: Map<string, SchoolRow[]>,
): number | null {
  const first = target.split("\n")[0].trim();
  const only = (name: string) => {
    const hits = byName.get(name);
    return hits?.length === 1 ? hits[0].no : null;
  };
  if (byName.has(first)) return only(first);
  return only(first.replace(/\s+\([^)]*\)$/, ""));
}

function parseCriteria(values: unknown[][] | null): string[][] | null {
  if (values === null) return null;
  const rows = values.map((r) => {
    const cells = r.map((c) => String(c ?? ""));
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    return cells;
  });
  return rows.filter((r) => r.length > 0);
}

export function parseSmsSender(raw: RawSource): SmsSenderData {
  const schoolRows = parseSchools(raw.sheets.schools);
  const docs = parseDocs(raw.sheets.docs);

  const byName = new Map<string, SchoolRow[]>();
  for (const s of schoolRows)
    byName.set(s.name, [...(byName.get(s.name) ?? []), s]);

  const copiesByNo = new Map<number, PdfCopy[]>();
  const unmatchedPdfs: string[] = [];
  for (const p of raw.pdfs) {
    if (!/\.pdf$/i.test(p.name)) continue;
    const name = pdfSchoolName(p.name);
    const targets = name ? byName.get(canonicalSchoolName(name)) : undefined;
    if (!targets) {
      unmatchedPdfs.push(p.name);
      continue;
    }
    for (const t of targets)
      copiesByNo.set(t.no, [...(copiesByNo.get(t.no) ?? []), toPdfCopy(p)]);
  }

  const schools: School[] = schoolRows.map((s) => ({
    ...s,
    docs: docs.get(s.no) ?? null,
    pdfs: [...(copiesByNo.get(s.no) ?? [])].sort(byRankThenRecent),
  }));

  const noByNameGubun = new Map<string, number>();
  for (const s of schoolRows) {
    const key = `${s.name}|${s.gubun}`;
    if (!noByNameGubun.has(key)) noByNameGubun.set(key, s.no);
  }
  const numbers: SenderNumber[] = parseNumbers(raw.sheets.numbers).map((n) => ({
    ...n,
    schoolNo: noByNameGubun.get(`${n.school}|${n.gubun}`) ?? null,
  }));
  const checks: CheckItem[] = parseChecks(raw.sheets.checks).map((c) => ({
    ...c,
    schoolNo: schoolNoOfTarget(c.target, byName),
  }));

  return {
    workbook: raw.workbook,
    fetchedAt: raw.fetchedAt,
    offRuleFiles: raw.offRuleFiles,
    schools,
    numbers,
    checks,
    unmatchedPdfs,
    criteria: parseCriteria(raw.criteria),
  };
}
