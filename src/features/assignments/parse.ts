import type {
  AssignmentSheet,
  AssignmentRecord,
  AssignmentDetail,
  ServiceKind,
  UnivAssignmentRow,
} from "./schemas";

/** 행 배열에서 정확히 일치하는 헤더 셀의 컬럼 인덱스 (없으면 -1) */
function colExact(headerRow: string[], label: string): number {
  return headerRow.findIndex((c) => c.trim() === label);
}
/** 정규식 매칭 헤더 컬럼 인덱스 (없으면 -1) */
function colMatch(headerRow: string[], re: RegExp): number {
  return headerRow.findIndex((c) => re.test(c.trim()));
}

const BLOCK_WIDTH = 6; // 블록당 sub-type 컬럼 수

/** 02. 배정리스트 → 원서접수 AssignmentRecord[] (r1 헤더의 '수시' 기준 그리드 대표) */
export function parseBaejungList(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 3) return [];
  const r0 = rows[0];
  const r1 = rows[1];
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

  // 각 블록의 sub-type 컬럼을 r1 라벨 기준으로 매핑. susiCol: '수시' 컬럼 (없으면 -1)
  const blockCols = blocks.map((b) => {
    const subtypes: { label: string; col: number }[] = [];
    let susiCol = -1;
    for (let off = 0; off < BLOCK_WIDTH; off++) {
      const col = b.start + off;
      const label = (r1[col] ?? "").trim();
      if (label === "") continue;
      subtypes.push({ label, col });
      if (label === "수시") susiCol = col;
    }
    return { ...b, subtypes, susiCol };
  });
  const repColOf = (role: string) =>
    blockCols.find((b) => b.year === "2027" && b.role === role)?.susiCol ?? -1;
  const opSusiCol = repColOf("운영");
  const devSusiCol = repColOf("개발");

  const op2027Block = blockCols.find((b) => b.year === "2027" && b.role === "운영");
  const dev2027Block = blockCols.find((b) => b.year === "2027" && b.role === "개발");
  const dev2027ColByLabel = new Map(
    (dev2027Block?.subtypes ?? []).map((st) => [st.label, st.col]),
  );

  const out: AssignmentRecord[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;

    const detail: AssignmentDetail[] = [];
    for (const b of blockCols) {
      for (const st of b.subtypes) {
        const v = (row[st.col] ?? "").trim();
        if (v) detail.push({ label: `${b.year} ${st.label} ${b.role}`, value: v });
      }
    }
    const operator = opSusiCol >= 0 ? (row[opSusiCol] ?? "").trim() : "";
    const developer = devSusiCol >= 0 ? (row[devSusiCol] ?? "").trim() : "";

    const subtypes: { label: string; operator: string; developer: string }[] = [];
    for (const st of op2027Block?.subtypes ?? []) {
      const op = (row[st.col] ?? "").trim();
      const devCol = dev2027ColByLabel.get(st.label);
      const dev = devCol != null ? (row[devCol] ?? "").trim() : "";
      if (op || dev) subtypes.push({ label: st.label, operator: op, developer: dev });
    }

    out.push({ university, service: "원서접수", operator, developer, detail, subtypes });
  }
  return out;
}

/** 단일 헤더 시트 (03/06/07) → AssignmentRecord[]. 헤더 정규식으로 컬럼 검출. */
export function parseSimpleSheet(
  sheet: AssignmentSheet,
  service: ServiceKind,
  patterns: { uni: RegExp; op: RegExp; dev?: RegExp },
): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 2) return [];
  const h = rows[0];
  const uniCol = colMatch(h, patterns.uni);
  const opCol = colMatch(h, patterns.op);
  const devCol = patterns.dev ? colMatch(h, patterns.dev) : -1;
  if (uniCol < 0 || opCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const operator = (row[opCol] ?? "").trim();
    const developer = devCol >= 0 ? (row[devCol] ?? "").trim() : "";
    out.push({ university, service, operator, developer, detail: [] });
  }
  return out;
}

/** 04. PIMS — 운영자 FULL(대표) + 운영자 환/충(detail). 개발자 없음. */
export function parsePims(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 2) return [];
  const h = rows[0];
  const uniCol = colMatch(h, /대학명/);
  const fullCol = colMatch(h, /운영자\s*FULL/);
  const hwanCol = colMatch(h, /운영자\s*환|환\/?충/);
  if (uniCol < 0 || fullCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const operator = (row[fullCol] ?? "").trim();
    const detail: AssignmentDetail[] = [];
    const hwan = (row[hwanCol] ?? "").trim();
    if (hwanCol >= 0 && hwan) {
      detail.push({ label: "운영자 환/충", value: hwan });
    }
    out.push({ university, service: "PIMS", operator, developer: "", detail });
  }
  return out;
}

/** AssignmentRecord[] → 대학명 기준 union 행 (가나다 정렬) */
export function joinByUniversity(recs: AssignmentRecord[]): UnivAssignmentRow[] {
  const map = new Map<string, UnivAssignmentRow>();
  for (const r of recs) {
    let row = map.get(r.university);
    if (!row) {
      row = { university: r.university, byService: {} };
      map.set(r.university, row);
    }
    row.byService[r.service] = r;
  }
  return [...map.values()].sort((a, b) =>
    a.university.localeCompare(b.university, "ko"),
  );
}
