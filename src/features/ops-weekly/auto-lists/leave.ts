/**
 * 휴가/외근 자동 목록 — 백업요청과 일정(달력) 두 원천을 한 줄로 합친다.
 * 같은 가족(휴가·외근·교육)이고 기간이 겹치면 같은 건으로 보고 백업요청 쪽(백업자가 있다)을 남긴다.
 * 휴가는 날짜 단위라 `at` 은 null 이고 기간은 `startYmd`·`endYmd` 가 든다.
 */
import { kstYmd, weekWindows, type YmdRange } from "../week";
import type { AutoItem } from "./application";

export type BackupLeaveLite = {
  id: string;
  leave_type: string | null;
  leave_start_date: string | null;
  leave_end_date: string | null;
  substitute_name: string;
};

export type ScheduleLeaveLite = {
  id: string;
  type: "leave" | "external_meeting" | "training";
  title: string;
  start_at: string;
  end_at: string | null;
  assignee_email: string | null;
};

export type LeaveFamily = "leave" | "field" | "training";

export type LeaveItem = AutoItem & {
  family: LeaveFamily;
  kindLabel: string;
  startYmd: string;
  endYmd: string;
  substituteName: string | null;
  sources: ("backup" | "schedule")[];
  needsBackup: boolean;
};

const SCHEDULE_FAMILY: Record<ScheduleLeaveLite["type"], LeaveFamily> = {
  leave: "leave",
  external_meeting: "field",
  training: "training",
};
const SCHEDULE_LABEL: Record<ScheduleLeaveLite["type"], string> = {
  leave: "휴가",
  external_meeting: "외근",
  training: "교육",
};

function overlaps(a: YmdRange, b: YmdRange): boolean {
  return a.startYmd <= b.endYmd && b.startYmd <= a.endYmd;
}

function familyOfBackup(type: string | null): LeaveFamily {
  if (type === "외근" || type === "출장") return "field";
  if (type === "교육") return "training";
  return "leave";
}

function fromBackup(row: BackupLeaveLite, window: YmdRange): LeaveItem | null {
  const start = row.leave_start_date;
  if (!start) return null;
  const end = row.leave_end_date ?? start;
  if (!overlaps({ startYmd: start, endYmd: end }, window)) return null;
  const kindLabel = row.leave_type ?? "휴가";
  return {
    key: `leave:br:${row.id}`,
    title: kindLabel,
    subtitle: `백업 ${row.substitute_name}`,
    at: null,
    family: familyOfBackup(row.leave_type),
    kindLabel,
    startYmd: start,
    endYmd: end,
    substituteName: row.substitute_name,
    sources: ["backup"],
    needsBackup: false,
  };
}

function isMine(
  row: ScheduleLeaveLite,
  operatorEmail: string,
  operatorName: string,
): boolean {
  if (row.assignee_email !== null) return row.assignee_email === operatorEmail;
  // 팀 공용 일정은 담당자 칸 없이 제목에 이름을 쓴다(달력 규칙).
  const name = operatorName.trim();
  return name !== "" && row.title.includes(name);
}

function instantYmd(iso: string): string | null {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : kstYmd(t);
}

function fromSchedule(
  row: ScheduleLeaveLite,
  window: YmdRange,
): LeaveItem | null {
  const start = instantYmd(row.start_at);
  if (start === null) return null;
  const end = (row.end_at ? instantYmd(row.end_at) : null) ?? start;
  if (!overlaps({ startYmd: start, endYmd: end }, window)) return null;
  const family = SCHEDULE_FAMILY[row.type];
  const kindLabel = SCHEDULE_LABEL[row.type];
  return {
    key: `leave:se:${row.id}`,
    title: kindLabel,
    subtitle: "백업 없음",
    at: null,
    family,
    kindLabel,
    startYmd: start,
    endYmd: end,
    substituteName: null,
    sources: ["schedule"],
    needsBackup: family === "leave",
  };
}

export function buildLeaveItems(args: {
  backups: readonly BackupLeaveLite[];
  schedules: readonly ScheduleLeaveLite[];
  operatorEmail: string;
  operatorName: string;
  weekStart: string;
}): LeaveItem[] {
  const { thisWeek, nextWeek } = weekWindows(args.weekStart);
  const window: YmdRange = {
    startYmd: thisWeek.startYmd,
    endYmd: nextWeek.endYmd,
  };
  let items: LeaveItem[] = [];
  for (const row of args.backups) {
    const item = fromBackup(row, window);
    if (item) items = [...items, item];
  }
  for (const row of args.schedules) {
    if (!isMine(row, args.operatorEmail, args.operatorName)) continue;
    const item = fromSchedule(row, window);
    if (!item) continue;
    const idx = items.findIndex(
      (b) =>
        b.sources.includes("backup") &&
        b.family === item.family &&
        overlaps(b, item),
    );
    items =
      idx < 0
        ? [...items, item]
        : items.map((b, i) =>
            i === idx ? { ...b, sources: [...b.sources, "schedule"] } : b,
          );
  }
  return [...items].sort(
    (a, b) =>
      a.startYmd.localeCompare(b.startYmd) || a.key.localeCompare(b.key),
  );
}
