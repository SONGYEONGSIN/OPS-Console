import type { LedgerRow } from "./types";

/** 실행 기록·화면에 그대로 실어도 되는 짧은 한국어 메시지만 담는다. 셀 값·주소는 싣지 않는다. */
export class ManualSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualSourceError";
  }
}

export const LEDGER_SHEET = "2. 매뉴얼 대장";
export const SCHEDULE_SHEET = "1. 연간 일정";

const LEDGER_REQUIRED = ["업무", "문서명", "담당자"] as const;
const SCHEDULE_REQUIRED = ["업무", "담당자"] as const;
const SECTION_MARK = "▪";
const OWNER_SEPARATOR = /[,，/·、\n]+/;

const cellText = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

/** 머리 셀은 공백·줄바꿈을 모두 지우고 비교한다 — `최종\n수정` 도 `최종 수정` 이다. */
const headerKey = (v: unknown): string => cellText(v).replace(/\s+/g, "");

type HeaderMap = Map<string, number>;

/** 필수 열 이름이 모두 있는 첫 행 — 제목·안내 행이 몇 줄 앞에 있어도 된다. */
function findHeader(
  values: unknown[][],
  required: readonly string[],
): { index: number; columns: HeaderMap } | null {
  for (let i = 0; i < values.length; i++) {
    const columns: HeaderMap = new Map();
    values[i].forEach((v, col) => {
      const key = headerKey(v);
      if (key && !columns.has(key)) columns.set(key, col);
    });
    if (required.every((name) => columns.has(name)))
      return { index: i, columns };
  }
  return null;
}

const at = (row: unknown[], col: number | undefined): string =>
  col === undefined ? "" : cellText(row[col]);

export function splitOwners(cell: string): string[] {
  const names = cell
    .split(OWNER_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(names)];
}

/**
 * `2. 매뉴얼 대장` → 행 목록. 머리행을 이름으로 찾는다.
 * 필수 열을 못 찾으면 **빈 결과가 아니라 실패**다 — 빈 결과는 '보낼 것 없음' 으로 조용히 끝난다.
 */
export function parseLedgerSheet(values: unknown[][]): LedgerRow[] {
  const header = findHeader(values, LEDGER_REQUIRED);
  if (!header) {
    throw new ManualSourceError(
      `매뉴얼 대장 머리행을 찾지 못했습니다 (${LEDGER_REQUIRED.join("·")})`,
    );
  }
  const c = header.columns;
  return values
    .slice(header.index + 1)
    .map((row): LedgerRow => {
      const ownerText = at(row, c.get("담당자"));
      const code = at(row, c.get("코드"));
      const lastModified = at(row, c.get("최종수정"));
      return {
        code: code || null,
        task: at(row, c.get("업무")),
        docName: at(row, c.get("문서명")),
        ownerText,
        owners: splitOwners(ownerText),
        lastModified: lastModified || null,
      };
    })
    .filter((r) => r.task !== "" || r.docName !== "");
}

type Section = "active" | "inactive";

/** 구역 머리행(`▪ …`)이면 그 구역, 아니면 null. 모르는 구역은 진행 중으로 보지 않는다. */
function sectionOf(row: unknown[]): Section | null {
  const mark = row.map(cellText).find((t) => t.startsWith(SECTION_MARK));
  if (mark === undefined) return null;
  const key = mark.replace(/\s+/g, "");
  if (key.includes("진행하지")) return "inactive";
  if (key.includes("이관") || key.includes("중단")) return "inactive";
  return key.includes("진행중") ? "active" : "inactive";
}

/**
 * `1. 연간 일정` → '진행 중' 구역 업무 이름. 상태 칸이 아니라 **구역 위치**로 가른다.
 * 진행 중 구역을 못 찾으면 실패다 — 0개 업무로 읽히면 아무에게도 안 간다.
 */
export function parseActiveTasks(values: unknown[][]): Set<string> {
  const header = findHeader(values, SCHEDULE_REQUIRED);
  if (!header) {
    throw new ManualSourceError(
      "연간 일정 머리행을 찾지 못했습니다 (업무·담당자)",
    );
  }
  const taskCol = header.columns.get("업무");
  const tasks = new Set<string>();
  let section: Section | null = null;
  let sawActive = false;
  for (const row of values.slice(header.index + 1)) {
    const next = sectionOf(row);
    if (next) {
      section = next;
      sawActive = sawActive || next === "active";
      continue;
    }
    const task = at(row, taskCol);
    if (section === "active" && task) tasks.add(task);
  }
  if (!sawActive) {
    throw new ManualSourceError(
      "연간 일정에서 '진행 중' 구역을 찾지 못했습니다",
    );
  }
  return tasks;
}
