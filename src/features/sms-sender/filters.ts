import type {
  CheckItem,
  Completeness,
  School,
  SenderNumber,
  SmsSenderData,
} from "./types";

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export type SchoolFilters = {
  q: string;
  gubun: string;
  stage: string;
  docs: Completeness | "";
  checkOnly: boolean;
  school: number | null;
};
export type GubunCard = {
  gubun: string;
  schools: number;
  lines: number;
  deficient: number;
  checks: number;
};
export type SchoolDetail = {
  school: School;
  numbers: SenderNumber[];
  checks: CheckItem[];
};
export type NumberFilters = {
  q: string;
  status: string;
  gubun: string;
  page: number;
};

export const GUBUN_ORDER = ["4년제", "전문대학", "대학원", "초중고"] as const;
export const STAGE_OPTIONS = [
  "접수",
  "접수+PIMS",
  "PIMS",
  "검토완료",
  "진행 중",
  "PDF 없음",
] as const;
export const NUMBER_STATUS_ORDER = [
  "일괄 등록",
  "추가 등록",
  "서류 미비",
] as const;
export const NUMBERS_PAGE_SIZE = 50;

const OTHER_GUBUN = "기타";
const DOCS_VALUES: readonly string[] = ["완비", "미비", "확인 안 됨"];

const isKnownGubun = (g: string) =>
  (GUBUN_ORDER as readonly string[]).includes(g);
const squash = (s: string) => s.replace(/\s+/g, "");

function positiveInt(value: string): number | null {
  const n = Number(value.trim() || NaN);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function parseSchoolFilters(sp: SearchParams): SchoolFilters {
  const docs = firstParam(sp.docs).trim();
  return {
    q: firstParam(sp.q).trim(),
    gubun: firstParam(sp.gubun).trim(),
    stage: firstParam(sp.stage).trim(),
    docs: DOCS_VALUES.includes(docs) ? (docs as Completeness) : "",
    checkOnly: firstParam(sp.check) === "1",
    school: positiveInt(firstParam(sp.school)),
  };
}

export function stageLabel(s: School): string {
  const top = s.pdfs[0];
  if (!top) return "PDF 없음";
  if (top.stage === "제출완료") return top.sub ?? "제출완료";
  if (top.stage === "기타") return "기타 폴더";
  return top.stage;
}

function matchesGubun(school: School, gubun: string): boolean {
  if (!gubun) return true;
  if (gubun === OTHER_GUBUN) return !isKnownGubun(school.gubun);
  return school.gubun === gubun;
}

export function filterSchools(
  schools: readonly School[],
  f: SchoolFilters,
): School[] {
  const q = squash(f.q);
  return schools.filter(
    (s) =>
      (!q || squash(s.name).includes(q)) &&
      matchesGubun(s, f.gubun) &&
      (!f.stage || stageLabel(s) === f.stage) &&
      (!f.docs || (s.docs?.completeness ?? "확인 안 됨") === f.docs) &&
      (!f.checkOnly || s.needsCheck),
  );
}

export function gubunCards(schools: readonly School[]): GubunCard[] {
  const card = (gubun: string, rows: readonly School[]): GubunCard => ({
    gubun,
    schools: rows.length,
    lines: rows.reduce((sum, s) => sum + s.lines, 0),
    deficient: rows.reduce((sum, s) => sum + s.deficient, 0),
    checks: rows.filter((s) => s.needsCheck).length,
  });
  const cards = GUBUN_ORDER.map((g) =>
    card(
      g,
      schools.filter((s) => s.gubun === g),
    ),
  );
  const others = schools.filter((s) => !isKnownGubun(s.gubun));
  return others.length > 0 ? [...cards, card(OTHER_GUBUN, others)] : cards;
}

export function schoolDetail(
  data: SmsSenderData,
  no: number | null,
): SchoolDetail | null {
  if (no === null) return null;
  const school = data.schools.find((s) => s.no === no);
  if (!school) return null;
  return {
    school,
    numbers: data.numbers.filter((n) => n.schoolNo === no),
    checks: data.checks.filter((c) => c.schoolNo === no),
  };
}

export function parseNumberFilters(sp: SearchParams): NumberFilters {
  return {
    q: firstParam(sp.q).trim(),
    status: firstParam(sp.status).trim(),
    gubun: firstParam(sp.gubun).trim(),
    page: positiveInt(firstParam(sp.page)) ?? 1,
  };
}

export function matchesNumberQuery(n: SenderNumber, q: string): boolean {
  const t = q.trim();
  if (!t) return true;
  const compact = t.replace(/[\s-]/g, "");
  if (/^\d+$/.test(compact)) return n.digits.includes(compact);
  return squash(n.school).includes(squash(t));
}

export function filterNumbers(
  rows: readonly SenderNumber[],
  f: NumberFilters,
): SenderNumber[] {
  return rows.filter(
    (n) =>
      (!f.status || n.status === f.status) &&
      (!f.gubun || n.gubun === f.gubun) &&
      matchesNumberQuery(n, f.q),
  );
}

export function pageSlice<T>(
  rows: readonly T[],
  page: number,
  size: number,
): T[] {
  const last = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), last);
  return rows.slice((p - 1) * size, p * size);
}

export function filterChecks(
  rows: readonly CheckItem[],
  kind: string,
): CheckItem[] {
  return kind ? rows.filter((c) => c.kind === kind) : [...rows];
}

export function orderedOptions(
  values: readonly string[],
  preferred: readonly string[],
): string[] {
  const rest = [...new Set(values)].filter((v) => !preferred.includes(v));
  return [...preferred, ...rest];
}
