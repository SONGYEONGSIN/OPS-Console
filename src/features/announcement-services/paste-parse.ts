/**
 * 합격자통합관리시스템(발표) 서비스 붙여넣기 파서.
 *
 * 연락처 일괄등록(contacts/paste-parse.ts)과 같은 방식 — 엑셀에서 표를 복사해
 * 붙여넣으면 헤더를 유연하게 매핑하고 행을 검증한다.
 *
 * 발표 자료는 '회차' 단위라 같은 서비스가 여러 줄로 온다(발표제목·일시만 다름).
 * 백업 요청 검색은 서비스 단위면 충분하므로 서비스ID로 합치고 최근 발표일만 남긴다.
 */

export type AnnouncementValues = {
  service_id?: number;
  university_id?: number;
  university_name?: string;
  service_name?: string;
  /** 이 서비스의 가장 최근 발표일시 (ISO 문자열) */
  last_announce_at?: string;
};

export type ParsedAnnouncementRow = {
  rowIndex: number;
  values: AnnouncementValues;
  errors: string[];
};

export type AnnouncementParseResult = {
  rows: ParsedAnnouncementRow[];
  unmappedHeaders: string[];
  headerError?: string;
  /** 회차 중복으로 합쳐진 행 수 */
  duplicateCount: number;
  /** 컷오프 이전 발표라 제외한 서비스 수 */
  staleCount: number;
};

type Field = keyof AnnouncementValues;

const ALIAS_GROUPS: [Field, string[]][] = [
  ["service_id", ["univserviceid", "서비스id", "서비스아이디", "서비스코드"]],
  ["university_id", ["univid", "대학id", "대학아이디", "학교id"]],
  ["university_name", ["univname", "대학명", "학교명", "대학", "학교"]],
  ["service_name", ["servicename", "서비스명", "서비스"]],
  [
    "last_announce_at",
    ["발표시작일시(실제)", "발표시작일시", "발표일시", "발표일", "발표시작"],
  ],
];

const HEADER_ALIASES: Record<string, Field> = {};
for (const [field, aliases] of ALIAS_GROUPS) {
  for (const a of aliases) HEADER_ALIASES[a.toLowerCase()] = field;
}

/** 검색 후보에 올릴 최소 발표일 — 올해 기준 2년 전 1월 1일. */
export function announcementCutoff(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - 2, 0, 1));
}

function detectDelimiter(headerLine: string): RegExp {
  if (headerLine.includes("\t")) return /\t/;
  if (headerLine.includes("·")) return /\s*·\s*/;
  if (headerLine.includes(",")) return /\s*,\s*/;
  return /\t/;
}

/** '2026-01-12 14:00:00.000' 같은 값을 Date로. 못 읽으면 null. */
function parseAnnounceAt(raw: string | undefined): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const d = new Date(text.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePastedAnnouncements(
  text: string,
  now: Date = new Date(),
): AnnouncementParseResult {
  const empty = { unmappedHeaders: [], duplicateCount: 0, staleCount: 0 };
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], ...empty };

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const mapped = headers.map((h) => HEADER_ALIASES[h.toLowerCase()]);
  const unmappedHeaders = headers.filter((_, i) => !mapped[i]);

  const required: Field[] = ["service_id", "university_name", "service_name"];
  const missing = required.filter((f) => !mapped.includes(f));
  if (missing.length > 0) {
    return {
      rows: [],
      ...empty,
      unmappedHeaders,
      headerError:
        "필수 열을 찾지 못했습니다 — 서비스ID·대학명·서비스명이 있어야 합니다. " +
        "(엑셀의 UnivServiceId / UnivName / ServiceName 열을 헤더째 복사)",
    };
  }

  // 서비스ID 기준으로 합친다 — 회차가 여러 줄이어도 서비스는 하나다.
  const merged = new Map<
    number,
    { row: ParsedAnnouncementRow; at: Date | null }
  >();
  const invalid: ParsedAnnouncementRow[] = [];
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const values: AnnouncementValues = {};
    let rawServiceId = "";
    let announceAt: Date | null = null;

    for (let col = 0; col < headers.length; col++) {
      const field = mapped[col];
      if (!field) continue;
      const cell = (cells[col] ?? "").trim();
      if (field === "service_id") {
        rawServiceId = cell;
      } else if (field === "university_id") {
        const n = Number(cell);
        if (cell !== "" && Number.isInteger(n)) values.university_id = n;
      } else if (field === "last_announce_at") {
        const at = parseAnnounceAt(cell);
        if (at) {
          announceAt = at;
          values.last_announce_at = at.toISOString();
        }
      } else if (cell !== "") {
        values[field] = cell as never;
      }
    }

    const errors: string[] = [];
    const serviceId = Number(rawServiceId);
    if (!rawServiceId || !Number.isInteger(serviceId) || serviceId <= 0) {
      errors.push("서비스ID가 숫자가 아닙니다");
    } else {
      values.service_id = serviceId;
    }
    if (!values.university_name) errors.push("대학명 없음");
    if (!values.service_name) errors.push("서비스명 없음");

    const row: ParsedAnnouncementRow = { rowIndex: i, values, errors };
    if (errors.length > 0 || values.service_id === undefined) {
      invalid.push(row);
      continue;
    }

    const prev = merged.get(values.service_id);
    if (!prev) {
      merged.set(values.service_id, { row, at: announceAt });
      continue;
    }
    duplicateCount += 1;
    // 최근 발표일을 남긴다 — 컷오프 판정도 이 값으로 한다.
    if (announceAt && (!prev.at || announceAt > prev.at)) {
      merged.set(values.service_id, { row, at: announceAt });
    }
  }

  const cutoff = announcementCutoff(now);
  const kept: ParsedAnnouncementRow[] = [];
  let staleCount = 0;
  for (const { row, at } of merged.values()) {
    // 발표일을 못 읽은 건은 제외하지 않는다 — 누락이 오래된 건이 섞이는 것보다 위험하다.
    if (at && at < cutoff) {
      staleCount += 1;
      continue;
    }
    kept.push(row);
  }

  return {
    rows: [...invalid, ...kept].sort((a, b) => a.rowIndex - b.rowIndex),
    unmappedHeaders,
    duplicateCount,
    staleCount,
  };
}
