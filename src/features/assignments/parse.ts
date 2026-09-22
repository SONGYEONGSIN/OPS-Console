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

/**
 * 파서가 읽는 학년도. **`02` 시트 헤더 문자열에 박혀 있고 시계에서 도출하지 않는다.**
 *
 * 원장에 넣을 학년도는 이 상수를 쓴다 — 이관이 `currentAcademicYear()` 를 넘기면
 * 3월에 학년도가 넘어갈 때 2027 블록의 값을 2028 로 적재하는데, **대조는 양쪽이
 * 같은 시트에서 나오므로 그대로 통과한다.** 조용히 한 해 틀린 원장이 남는다.
 *
 * **헤더를 찾는 정규식이 이 상수에서 만들어진다.** 예전엔 `/2027.*운영자/` 가 따로
 * 적혀 있어 상수와 갈릴 수 있었다 — 시트에 다음 학년도 열이 생기면 이 상수만 올린다.
 */
export const BAEJUNG_CURRENT_YEAR = 2027;

/**
 * 시트가 **함께** 들고 있는 전년도 블록. `02` 는 `2026학년도 운영자` 열을 그대로
 * 두고, `03`·`04`·`06` 은 `前 운영자` 칸에 같은 것을 담는다.
 *
 * 과거 학년도 배분현황의 담당자가 여기서 온다. 예전엔 `services.operator_email` 을
 * 우회로로 썼는데 그건 2026-02-28 에 멈춘 시트 임포트라, 원장 이름과 표기가 갈리면
 * 같은 사람이 두 사람으로 세어졌다 — 시트에서 읽으면 양쪽이 다 원장 이름이 된다.
 */
export const BAEJUNG_PREV_YEAR = 2026;

/** 시트가 들고 있는 학년도 블록. 새 열이 생기면 위 두 상수를 올린다. */
const BAEJUNG_YEARS = [BAEJUNG_CURRENT_YEAR, BAEJUNG_PREV_YEAR] as const;

const BLOCK_WIDTH = 6; // 블록당 sub-type 컬럼 수

/**
 * 블록의 여섯 번째 칸은 **백업자**다 — 배정이 아니라 공백 때 대신 볼 사람이다.
 *
 * `startsWith` 인 이유: 설계 문서는 `백업`, 라이브 시트는 `백업자` 다. 한쪽만
 * 막으면 시트 문구가 바뀌는 날 백업자가 다시 배정으로 흘러 원장에 들어가는데,
 * **그 오염은 조용하다** — 원장 행이 늘 뿐 어디서도 에러가 나지 않는다.
 */
const isBackupLabel = (label: string) => label.startsWith("백업");

/** '담당자 변경' 칸. 네 배정 시트가 같은 헤더 문구를 쓴다. */
const CHANGED_HEADER = /담당자\s*변경/;

/** 헤더에 '담당자 변경' 이 있으면 그 칸 원문, 없으면 undefined. */
function changedOf(row: string[], col: number): string | undefined {
  if (col < 0) return undefined;
  return (row[col] ?? "").trim() || undefined;
}

/**
 * 02. 배정리스트 → 원서접수 AssignmentRecord[] (r1 헤더의 '수시' 기준 그리드 대표)
 *
 * `year` 는 **원장으로 갈 블록**을 고른다. `detail` 은 시트에 있는 모든 학년도를
 * 그대로 담아 인스펙터가 과거까지 보여주고, `operator`·`subtypes` 만 그 해의 것이다.
 * 없는 학년도를 물으면 빈 배열이다 — 없는 열을 만들어 내지 않는다.
 */
export function parseBaejungList(
  sheet: AssignmentSheet,
  year: number = BAEJUNG_CURRENT_YEAR,
): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 3) return [];
  const r0 = rows[0];
  const r1 = rows[1];
  const uniCol = colExact(r0, "대학명");
  const typeCol = colExact(r0, "대분류");
  const changedCol = colMatch(r0, CHANGED_HEADER);

  const blocks: { year: number; role: string; start: number }[] =
    BAEJUNG_YEARS.flatMap((y) => [
      { year: y, role: "운영", start: colMatch(r0, new RegExp(`${y}.*운영자`)) },
      { year: y, role: "개발", start: colMatch(r0, new RegExp(`${y}.*개발자`)) },
    ]).filter((b) => b.start >= 0);

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
  const opBlock = blockCols.find((b) => b.year === year && b.role === "운영");
  const devBlock = blockCols.find((b) => b.year === year && b.role === "개발");
  if (uniCol < 0 || !opBlock) return [];

  const opSusiCol = opBlock.susiCol;
  const devSusiCol = devBlock?.susiCol ?? -1;
  const devColByLabel = new Map(
    (devBlock?.subtypes ?? []).map((st) => [st.label, st.col]),
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
        if (v)
          detail.push({ label: `${b.year} ${st.label} ${b.role}`, value: v });
      }
    }
    const operator = opSusiCol >= 0 ? (row[opSusiCol] ?? "").trim() : "";
    const developer = devSusiCol >= 0 ? (row[devSusiCol] ?? "").trim() : "";

    // **백업자는 여기서 갈라진다.** `detail` 에는 위 루프가 이미 담았으므로
    // 인스펙터 표시는 그대로고, 원장으로 가는 `subtypes` 에서만 빠진다.
    let backupOperator: string | undefined;
    const subtypes: { label: string; operator: string; developer: string }[] =
      [];
    for (const st of opBlock.subtypes) {
      const op = (row[st.col] ?? "").trim();
      if (isBackupLabel(st.label)) {
        if (op) backupOperator = op;
        continue;
      }
      const devCol = devColByLabel.get(st.label);
      const dev = devCol != null ? (row[devCol] ?? "").trim() : "";
      if (op || dev)
        subtypes.push({ label: st.label, operator: op, developer: dev });
    }

    const universityType =
      typeCol >= 0 ? (row[typeCol] ?? "").trim() || undefined : undefined;
    out.push({
      university,
      service: "원서접수",
      universityType,
      operator,
      developer,
      detail,
      subtypes,
      backupOperator,
      assigneeChanged: changedOf(row, changedCol),
    });
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
  const changedCol = colMatch(h, CHANGED_HEADER);
  if (uniCol < 0 || opCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const operator = (row[opCol] ?? "").trim();
    const developer = devCol >= 0 ? (row[devCol] ?? "").trim() : "";
    out.push({
      university,
      service,
      operator,
      developer,
      detail: [],
      assigneeChanged: changedOf(row, changedCol),
    });
  }
  return out;
}

/**
 * 04. PIMS — 하위유형 **FULL·환충** 두 칸. 개발자는 없다.
 *
 * **두 칸은 독립된 배정이다**(사용자 확인 2026-09-15). 그래서 `subtypes` 로 따로
 * 내보낸다 — `operator` 는 `full || hwan` 으로 접힌 그리드 대표값이라 **배정을 세는
 * 쪽이 쓰면 한쪽이 조용히 사라진다.**
 *
 * `접수운영자` 칸은 읽지 않는다 — 02 배정리스트의 수시 담당자와 70/70 일치하는
 * 사본이라(라이브 실측 2026-09-15, 대조군 `운영자 FULL` 은 43%) 원장에 넣으면 같은
 * 배정이 두 벌이 된다. `前 운영자` 도 과거값이라 읽지 않는다.
 */
export function parsePims(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 2) return [];
  const h = rows[0];
  const uniCol = colMatch(h, /대학명/);
  const fullCol = colMatch(h, /운영자\s*FULL/);
  const hwanCol = colMatch(h, /운영자\s*환|환\/?충/);
  const changedCol = colMatch(h, CHANGED_HEADER);
  if (uniCol < 0 || fullCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const full = (row[fullCol] ?? "").trim();
    const hwan = hwanCol >= 0 ? (row[hwanCol] ?? "").trim() : "";
    // 그리드 폴백·검색용 대표값. FULL 이 비면 환/충 이름이 올라와 둘이 구분되지
    // 않으므로 **배정의 단위로 쓰면 안 된다** — 그건 아래 subtypes 다.
    const operator = full || hwan;
    const detail: AssignmentDetail[] = [];
    if (hwan) {
      detail.push({ label: "운영자 환/충", value: hwan });
    }
    // 라벨은 **`FULL`·`환충`** 고정이다 — 원장 자연키가 이 문자열로 들어가 있어,
    // 시트 헤더를 따라 `환/충` 으로 적으면 다음 이관이 행을 새로 만들고 기존 행이
    // 고아가 된다. 빈 칸은 항목을 만들지 않는다(없는 배정을 발명하지 않는다).
    const subtypes = [
      ...(full ? [{ label: "FULL", operator: full, developer: "" }] : []),
      ...(hwan ? [{ label: "환충", operator: hwan, developer: "" }] : []),
    ];
    out.push({
      university,
      service: "PIMS",
      operator,
      developer: "",
      detail,
      subtypes,
      assigneeChanged: changedOf(row, changedCol),
    });
  }
  return out;
}

/** AssignmentRecord[] → 대학명 기준 union 행 (가나다 정렬) */
export function joinByUniversity(
  recs: AssignmentRecord[],
): UnivAssignmentRow[] {
  const map = new Map<string, UnivAssignmentRow>();
  for (const r of recs) {
    let row = map.get(r.university);
    if (!row) {
      row = { university: r.university, byService: {} };
      map.set(r.university, row);
    }
    row.byService[r.service] = r;
    // baejung 행만 universityType을 가짐 — 먼저 발견된 값으로 유지
    if (!row.universityType && r.universityType) {
      row.universityType = r.universityType;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.university.localeCompare(b.university, "ko"),
  );
}
