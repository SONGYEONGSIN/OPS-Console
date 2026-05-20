import type {
  AssignmentSheet,
  AssignmentRecord,
  AssignmentDetail,
} from "./schemas";

/** 행 배열에서 정확히 일치하는 헤더 셀의 컬럼 인덱스 (없으면 -1) */
function colExact(headerRow: string[], label: string): number {
  return headerRow.findIndex((c) => c.trim() === label);
}
/** 정규식 매칭 헤더 컬럼 인덱스 (없으면 -1) */
function colMatch(headerRow: string[], re: RegExp): number {
  return headerRow.findIndex((c) => re.test(c.trim()));
}

const SUBTYPE_ORDER = ["재외", "수시", "정시", "편입", "외국인", "백업"] as const;
const SUSI_OFFSET = 1; // 수시 = 블록 시작 + 1

/** 02. 배정리스트 → 원서접수 AssignmentRecord[] (수시 기준 그리드 대표) */
export function parseBaejungList(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 3) return [];
  const r0 = rows[0];
  const uniCol = colExact(r0, "대학명");
  const op2027 = colMatch(r0, /2027.*운영자/);
  const dev2027 = colMatch(r0, /2027.*개발자/);
  const op2026 = colMatch(r0, /2026.*운영자/);
  const dev2026 = colMatch(r0, /2026.*개발자/);
  if (uniCol < 0 || op2027 < 0) return [];

  const blocks: { year: string; role: string; start: number }[] = [
    { year: "2027", role: "운영", start: op2027 },
    { year: "2027", role: "개발", start: dev2027 },
    { year: "2026", role: "운영", start: op2026 },
    { year: "2026", role: "개발", start: dev2026 },
  ].filter((b) => b.start >= 0);

  const out: AssignmentRecord[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;

    const detail: AssignmentDetail[] = [];
    for (const b of blocks) {
      SUBTYPE_ORDER.forEach((st, off) => {
        const v = (row[b.start + off] ?? "").trim();
        if (v) detail.push({ label: `${b.year} ${st} ${b.role}`, value: v });
      });
    }
    const operator = (row[op2027 + SUSI_OFFSET] ?? "").trim();
    const developer = dev2027 >= 0 ? (row[dev2027 + SUSI_OFFSET] ?? "").trim() : "";
    out.push({ university, service: "원서접수", operator, developer, detail });
  }
  return out;
}
