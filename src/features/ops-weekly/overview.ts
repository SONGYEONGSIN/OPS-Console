// 관리 탭 '전체 현황' — 최근 주별 제출 수·당번을 한 줄로 만드는 순수 함수.
// server-only 가 아니다: 클라이언트 표가 이 모듈을 값으로 import 한다.
// 그래서 server-only 인 report-queries 는 `import type` 한 문장으로만 가져온다.
import type { ReportStatusRow } from "./report-queries";
import { normEmail } from "./email";
import type { WriterCandidate } from "./roster";
import { normalizedWeekStateOf, type WeekRow } from "./schemas";
import type { WeekState } from "./permissions";
import { weekRefFromStart } from "./week";

export const OVERVIEW_WEEKS = 8;

export type WeekPhase = "open" | "reopened" | "reported";

export function weekPhaseOf(state: WeekState): WeekPhase {
  if (state.status === "reported") return "reported";
  return state.reopenedAt !== null ? "reopened" : "open";
}

export type WeekOverviewRow = {
  weekId: string;
  weekStart: string;
  label: string;
  rangeLabel: string;
  state: WeekState;
  reportedAt: string | null;
  submitted: number;
  total: number;
  dutyName: string | null;
};

function dutyNameOf(
  dutyEmail: string | null,
  writers: readonly WriterCandidate[],
): string | null {
  if (dutyEmail === null) return null;
  const key = normEmail(dutyEmail);
  return writers.find((w) => w.email === key)?.name ?? dutyEmail;
}

function countsOf(
  week: WeekRow,
  state: WeekState,
  reports: readonly ReportStatusRow[],
  rosterEmails: ReadonlySet<string>,
): { submitted: number; total: number } {
  const mine = reports.filter((r) => r.weekId === week.id);
  const submittedRows = mine.filter((r) => r.status === "submitted");
  if (state.status === "reported") {
    return { submitted: submittedRows.length, total: mine.length };
  }
  return {
    submitted: submittedRows.filter((r) => rosterEmails.has(r.operatorEmail))
      .length,
    total: rosterEmails.size,
  };
}

export function buildWeekOverview(args: {
  weeks: readonly WeekRow[];
  reports: readonly ReportStatusRow[];
  writers: readonly WriterCandidate[];
}): WeekOverviewRow[] {
  const { weeks, reports, writers } = args;
  const rosterEmails = new Set(writers.map((w) => w.email));
  return weeks.map((week) => {
    const state = normalizedWeekStateOf(week);
    const ref = weekRefFromStart(week.week_start);
    return {
      weekId: week.id,
      weekStart: week.week_start,
      label: ref?.label ?? week.week_start,
      rangeLabel: ref?.rangeLabel ?? "",
      state,
      reportedAt: week.reported_at,
      ...countsOf(week, state, reports, rosterEmails),
      dutyName: dutyNameOf(week.duty_email, writers),
    };
  });
}
