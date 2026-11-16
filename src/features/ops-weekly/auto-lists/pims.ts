/**
 * PIMS 발표 예정 자동 목록 — 운영자별 금주/차주 두 묶음.
 * 창은 KST 월~일이고, 발표일(`last_announce_at`)이 없는 행은 어느 묶음에도 안 든다.
 */
import { kstYmd, weekWindows, ymdInRange } from "../week";
import { sameName, type AutoItem } from "./application";

export type PimsLite = {
  service_id: number;
  university_name: string;
  service_name: string;
  operator_name: string | null;
  last_announce_at: string | null;
};

export type PimsGroups = { thisWeek: AutoItem[]; nextWeek: AutoItem[] };

function announceYmd(at: string | null): string | null {
  if (!at) return null;
  const t = new Date(at);
  return Number.isNaN(t.getTime()) ? null : kstYmd(t);
}

function toItem(row: PimsLite): AutoItem {
  return {
    key: `pims:${row.service_id}`,
    title: row.university_name,
    subtitle: row.service_name,
    at: row.last_announce_at,
  };
}

function byAt(a: AutoItem, b: AutoItem): number {
  const d = Date.parse(a.at ?? "") - Date.parse(b.at ?? "");
  return d !== 0 ? d : a.title.localeCompare(b.title, "ko");
}

export function buildPimsGroups(args: {
  rows: readonly PimsLite[];
  operatorName: string;
  weekStart: string;
}): PimsGroups {
  const { thisWeek, nextWeek } = weekWindows(args.weekStart);
  const mine: AutoItem[][] = [[], []];
  for (const row of args.rows) {
    if (!sameName(row.operator_name, args.operatorName)) continue;
    const ymd = announceYmd(row.last_announce_at);
    if (ymd === null) continue;
    if (ymdInRange(ymd, thisWeek)) mine[0].push(toItem(row));
    else if (ymdInRange(ymd, nextWeek)) mine[1].push(toItem(row));
  }
  return {
    thisWeek: [...mine[0]].sort(byAt),
    nextWeek: [...mine[1]].sort(byAt),
  };
}

/** 금주·차주 창에 드는데 담당이 명단에 안 붙는 행 수. 담당 null·공백·퇴사자도 센다. */
export function countUnmatchedPims(args: {
  rows: readonly PimsLite[];
  writerNames: ReadonlySet<string>;
  weekStart: string;
}): number {
  const { thisWeek, nextWeek } = weekWindows(args.weekStart);
  let n = 0;
  for (const row of args.rows) {
    const ymd = announceYmd(row.last_announce_at);
    if (ymd === null) continue;
    if (!ymdInRange(ymd, thisWeek) && !ymdInRange(ymd, nextWeek)) continue;
    const name = row.operator_name?.trim() ?? "";
    if (name === "" || !args.writerNames.has(name)) n += 1;
  }
  return n;
}
