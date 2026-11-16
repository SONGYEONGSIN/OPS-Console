import "server-only";

/**
 * 보고서 조회 — 늦은 생성(lazy)과 지난주 값 미리 채우기.
 * 동시 첫 접근은 unique 제약(`unique (week_id, operator_email)`, `unique (report_id, project_id)`)에 맡긴다.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AREAS,
  type Area,
  type ProjectKind,
  type ProjectStage,
} from "./constants";
import { normEmail } from "./email";
import type { ItemOverride, ManualItem, ProjectEntryView } from "./merge";
import { copyNoteImages, opsWeeklyImagePrefix } from "./note-images";
import { prefillEntry } from "./prefill";
import type { WriterCandidate } from "./roster";
import { reportRowSchema, type ReportRow } from "./schemas";
import { shiftWeek } from "./week";
import {
  assertWritten,
  getWeek,
  getWeekById,
  listWriters,
  rowOf,
  rowsOf,
} from "./week-queries";

const UNIQUE_VIOLATION = "23505";

export type ReportDetail = {
  notes: Record<Area, { thisWeek: string; nextWeek: string }>;
  overrides: Map<string, ItemOverride>;
  manual: ManualItem[];
  projects: ProjectEntryView[];
};

type EntryRow = {
  report_id: string;
  project_id: string;
  stage: ProjectStage | null;
  this_week: string;
  next_week: string;
};
type ProjectRow = {
  id: string;
  name: string;
  kind: ProjectKind;
  sort_order: number;
};

async function readReport(
  weekId: string,
  operatorEmail: string,
): Promise<ReportRow | null> {
  const email = normEmail(operatorEmail);
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("*")
    .eq("week_id", weekId)
    .eq("operator_email", email)
    .maybeSingle();
  const row = rowOf<unknown>("ops_weekly_reports", res);
  return row === null ? null : reportRowSchema.parse(row);
}

/** 그 운영자가 맡은 활성 프로젝트·TF id. 그림 업로드 자격(Task 8)도 이것으로 본다. */
export async function activeOwnedProjectIds(
  operatorEmail: string,
): Promise<string[]> {
  const db = createAdminClient();
  const owned = rowsOf<{ project_id: string }>(
    "ops_weekly_project_owners",
    await db
      .from("ops_weekly_project_owners")
      .select("project_id")
      .eq("operator_email", normEmail(operatorEmail)),
  ).map((r) => r.project_id);
  if (owned.length === 0) return [];
  return rowsOf<{ id: string }>(
    "ops_weekly_projects",
    await db
      .from("ops_weekly_projects")
      .select("id")
      .in("id", owned)
      .eq("active", true),
  ).map((r) => r.id);
}

async function entryProjectIds(reportId: string): Promise<Set<string>> {
  const res = await createAdminClient()
    .from("ops_weekly_project_entries")
    .select("project_id")
    .eq("report_id", reportId);
  return new Set(
    rowsOf<{ project_id: string }>("ops_weekly_project_entries", res).map(
      (r) => r.project_id,
    ),
  );
}

/** 지난주 같은 (프로젝트, 운영자) entry. 지난주 주·보고서가 없으면 빈 맵이다. */
async function lastWeekEntries(
  weekStart: string,
  operatorEmail: string,
  projectIds: readonly string[],
): Promise<Map<string, EntryRow>> {
  const prevWeek = await getWeek(shiftWeek(weekStart, -1));
  if (prevWeek === null) return new Map();
  const prevReport = rowOf<{ id: string }>(
    "ops_weekly_reports",
    await createAdminClient()
      .from("ops_weekly_reports")
      .select("id")
      .eq("week_id", prevWeek.id)
      .eq("operator_email", normEmail(operatorEmail))
      .maybeSingle(),
  );
  if (prevReport === null) return new Map();
  const res = await createAdminClient()
    .from("ops_weekly_project_entries")
    .select("report_id, project_id, stage, this_week, next_week")
    .eq("report_id", prevReport.id)
    .in("project_id", [...projectIds]);
  return new Map(
    rowsOf<EntryRow>("ops_weekly_project_entries", res).map((r) => [
      r.project_id,
      r,
    ]),
  );
}

async function fillMissingEntries(
  report: ReportRow,
  weekStart: string,
): Promise<void> {
  const active = await activeOwnedProjectIds(report.operator_email);
  if (active.length === 0) return;
  const have = await entryProjectIds(report.id);
  const missing = active.filter((id) => !have.has(id));
  if (missing.length === 0) return;
  const prev = await lastWeekEntries(weekStart, report.operator_email, missing);
  const filled = missing.map((id) => prefillEntry(prev.get(id) ?? null));
  // 지난주 그림은 지난주 보고서 경로에 있어 첫 저장에서 지워진다 — 이 보고서 경로로 복사한다.
  const thisWeek = await copyNoteImages(
    filled.map((e) => e.this_week),
    opsWeeklyImagePrefix(weekStart, report.id),
  );
  const rows = missing.map((projectId, i) => ({
    report_id: report.id,
    project_id: projectId,
    ...filled[i],
    this_week: thisWeek[i],
  }));
  const res = await createAdminClient()
    .from("ops_weekly_project_entries")
    .insert(rows);
  // 동시에 들어온 다른 요청이 먼저 채웠다 — 그 값이 이미 있으므로 넘어간다.
  if (res.error?.code === UNIQUE_VIOLATION) return;
  assertWritten("ops_weekly_project_entries", res);
}

/**
 * 보고서 행을 만들고(있으면 그대로), 본인이 맡은 활성 프로젝트 중 entry 가 없는 것을 지난주 값으로 채운다.
 * 멱등이다. 주 중에 담당이 추가되면 다음 접근에서 채워진다.
 */
export async function ensureReport(
  weekId: string,
  rawEmail: string,
): Promise<ReportRow> {
  const operatorEmail = normEmail(rawEmail);
  const week = await getWeekById(weekId);
  if (week === null)
    throw new Error(`[ops-weekly] 주를 찾을 수 없다: ${weekId}`);
  assertWritten(
    "ops_weekly_reports",
    await createAdminClient()
      .from("ops_weekly_reports")
      .upsert(
        { week_id: weekId, operator_email: operatorEmail },
        { onConflict: "week_id,operator_email", ignoreDuplicates: true },
      ),
  );
  const report = await readReport(weekId, operatorEmail);
  if (report === null) {
    throw new Error(
      "[ops-weekly] ops_weekly_reports: 만든 보고서를 다시 읽지 못했다",
    );
  }
  await fillMissingEntries(report, week.week_start);
  return report;
}

export async function listReports(weekId: string): Promise<ReportRow[]> {
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("*")
    .eq("week_id", weekId)
    .order("operator_email", { ascending: true });
  return rowsOf<unknown>("ops_weekly_reports", res).map((r) =>
    reportRowSchema.parse(r),
  );
}

/** 명단 중 제출(`submitted`)하지 않은 사람 — 보고서 행이 없어도 미제출이다. */
export async function listPendingWriters(
  weekId: string,
): Promise<WriterCandidate[]> {
  const writers = await listWriters();
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("operator_email")
    .eq("week_id", weekId)
    .eq("status", "submitted");
  const submitted = new Set(
    rowsOf<{ operator_email: string }>("ops_weekly_reports", res).map((r) =>
      normEmail(r.operator_email),
    ),
  );
  return writers.filter((w) => !submitted.has(w.email));
}

async function viewsOf(
  entries: readonly EntryRow[],
  emailByReport: ReadonlyMap<string, string>,
): Promise<ProjectEntryView[]> {
  if (entries.length === 0) return [];
  const db = createAdminClient();
  const projects = new Map(
    rowsOf<ProjectRow>(
      "ops_weekly_projects",
      await db
        .from("ops_weekly_projects")
        .select("id, name, kind, sort_order")
        .in("id", [...new Set(entries.map((e) => e.project_id))]),
    ).map((p) => [p.id, p]),
  );
  // 대소문자가 다른 operators.email 도 잡도록 필터 없이 읽어 정규화 키로 맞춘다(명단 규모가 작다).
  const names = new Map(
    rowsOf<{ email: string; name: string }>(
      "operators",
      await db.from("operators").select("email, name"),
    ).map((o) => [normEmail(o.email), o.name.trim()]),
  );
  return entries
    .flatMap((e): ProjectEntryView[] => {
      const project = projects.get(e.project_id);
      const email = emailByReport.get(e.report_id);
      if (!project || email === undefined) return [];
      return [
        {
          projectId: project.id,
          projectName: project.name,
          kind: project.kind,
          sortOrder: project.sort_order,
          operatorEmail: email,
          operatorName: names.get(normEmail(email)) ?? email,
          stage: e.stage,
          thisWeek: e.this_week,
          nextWeek: e.next_week,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.projectName.localeCompare(b.projectName, "ko") ||
        a.operatorName.localeCompare(b.operatorName, "ko"),
    );
}

async function entriesOf(reportIds: readonly string[]): Promise<EntryRow[]> {
  const res = await createAdminClient()
    .from("ops_weekly_project_entries")
    .select("report_id, project_id, stage, this_week, next_week")
    .in("report_id", [...reportIds]);
  return rowsOf<EntryRow>("ops_weekly_project_entries", res);
}

/** 당번 모아보기용(A3 엑셀·워드도 이것을 쓴다). */
export async function listProjectEntriesForWeek(
  weekId: string,
): Promise<ProjectEntryView[]> {
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("id, operator_email")
    .eq("week_id", weekId);
  const reports = rowsOf<{ id: string; operator_email: string }>(
    "ops_weekly_reports",
    res,
  );
  if (reports.length === 0) return [];
  const emailByReport = new Map(reports.map((r) => [r.id, r.operator_email]));
  return viewsOf(await entriesOf(reports.map((r) => r.id)), emailByReport);
}

const emptyNotes = (): ReportDetail["notes"] =>
  Object.fromEntries(
    AREAS.map((a) => [a, { thisWeek: "", nextWeek: "" }]),
  ) as ReportDetail["notes"];

export async function loadReportDetail(
  reportId: string,
): Promise<ReportDetail> {
  const db = createAdminClient();
  const report = rowOf<{ operator_email: string }>(
    "ops_weekly_reports",
    await db
      .from("ops_weekly_reports")
      .select("operator_email")
      .eq("id", reportId)
      .maybeSingle(),
  );
  if (report === null) {
    throw new Error(`[ops-weekly] 보고서를 찾을 수 없다: ${reportId}`);
  }
  const [noteRows, overrideRows, manual, entries] = await Promise.all([
    db
      .from("ops_weekly_area_notes")
      .select("area, this_week, next_week")
      .eq("report_id", reportId),
    db
      .from("ops_weekly_item_overrides")
      .select("item_key, note, excluded")
      .eq("report_id", reportId),
    db
      .from("ops_weekly_manual_items")
      .select(
        "id, area, group_key, title, note, period_start, period_end, leave_kind",
      )
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
    entriesOf([reportId]),
  ]);
  const notes = emptyNotes();
  for (const n of rowsOf<{ area: Area; this_week: string; next_week: string }>(
    "ops_weekly_area_notes",
    noteRows,
  )) {
    notes[n.area] = { thisWeek: n.this_week, nextWeek: n.next_week };
  }
  const overrides = new Map(
    rowsOf<ItemOverride>("ops_weekly_item_overrides", overrideRows).map((o) => [
      o.item_key,
      { item_key: o.item_key, note: o.note, excluded: o.excluded },
    ]),
  );
  return {
    notes,
    overrides,
    manual: rowsOf<ManualItem>("ops_weekly_manual_items", manual),
    projects: await viewsOf(
      entries,
      new Map([[reportId, report.operator_email]]),
    ),
  };
}
