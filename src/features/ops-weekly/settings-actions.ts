"use server";

/**
 * 주간업무보고 관리자 설정 action — 받는 사람·순번표·제외·프로젝트/TF·주별 당번.
 * server action 은 라우트 가드가 없다: 매번 세션과 admin 여부를 다시 읽고, 폼 값은 믿지 않는다.
 */
import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./actions";
import { OPS_WEEKLY_PATHS, type ProjectKind } from "./constants";
import { normEmail } from "./email";
import { canManageSettings } from "./permissions";
import type { RecipientWarning } from "./roster";
import {
  emailInputSchema,
  excludedWritersInputSchema,
  includedWritersInputSchema,
  projectInputSchema,
  projectOwnersInputSchema,
  rotationInputSchema,
  weekDutyInputSchema,
} from "./schemas";
import { listOperatorLookups, warningFromOperators } from "./settings-queries";
import { weekRefFromStart } from "./week";
import { getWeekById, listWriters } from "./week-queries";

type Fail = { ok: false; error: string };
type Admin = { email: string };

const OK: ActionResult = { ok: true };
const failOf = (error: string): Fail => ({ ok: false, error });
const isFail = <T extends object>(v: T | Fail): v is Fail =>
  "ok" in v && v.ok === false;

const NOT_ADMIN = "관리자만 설정할 수 있습니다.";
const DUP_NAME = "이미 있는 항목 이름입니다.";
const NOT_WRITER = "작성 명단에 없는 사람이 있습니다.";
const DUTY_LOCKED = "보고가 끝난 주의 당번은 바꿀 수 없습니다.";
const UNIQUE_VIOLATION = "23505";

async function requireAdmin(): Promise<Admin | Fail> {
  const me = await getCurrentOperator();
  if (!me) return failOf("로그인이 필요합니다.");
  const actor = {
    email: normEmail(me.email),
    isAdmin: me.permission === "admin",
  };
  return canManageSettings(actor) ? { email: actor.email } : failOf(NOT_ADMIN);
}

function done(): ActionResult {
  for (const path of OPS_WEEKLY_PATHS) revalidatePath(path);
  return OK;
}

const writeFailed = (label: string, message: string): Fail =>
  failOf(`${label} 저장에 실패했습니다: ${message}`);

async function writerEmailSet(): Promise<Set<string>> {
  return new Set((await listWriters()).map((w) => w.email));
}

export async function addRecipient(input: {
  email: string;
}): Promise<ActionResult & { warning?: RecipientWarning | null }> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = emailInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const { email } = parsed.data;
  const res = await createAdminClient()
    .from("ops_weekly_recipients")
    .upsert(
      { email, created_by: admin.email },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (res.error) return writeFailed("받는 사람", res.error.message);
  const { warning } = warningFromOperators(await listOperatorLookups(), email);
  return { ...done(), warning };
}

export async function removeRecipient(input: {
  email: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = emailInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const res = await createAdminClient()
    .from("ops_weekly_recipients")
    .delete()
    .eq("email", parsed.data.email);
  if (res.error) return writeFailed("받는 사람", res.error.message);
  return done();
}

export async function saveRotation(input: {
  emails: string[];
  anchorWeekStart: string | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = rotationInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const { emails, anchorWeekStart } = parsed.data;
  if (new Set(emails).size !== emails.length) {
    return failOf("순번표에 같은 사람이 두 번 있습니다.");
  }
  if (emails.length > 0 && anchorWeekStart === null) {
    return failOf("순번표가 있으면 기준 주를 정하세요.");
  }
  if (anchorWeekStart !== null && weekRefFromStart(anchorWeekStart) === null) {
    return failOf("기준 주는 월요일이어야 합니다.");
  }
  const writers = await writerEmailSet();
  if (emails.some((e) => !writers.has(e))) return failOf(NOT_WRITER);
  const db = createAdminClient();
  // 지우기·넣기는 SQL 함수 한 번(한 트랜잭션) — 클라이언트 delete-all 은 safeupdate 가 거부하고,
  // 중간에 실패하면 순번표가 빈 채로 남는다.
  const rpc = await db.rpc("ops_weekly_replace_rotation", { emails });
  if (rpc.error) return failOf("순번표를 저장하지 못했습니다.");
  // 이미 만들어진 주의 duty_email 은 건드리지 않는다.
  const res = await db
    .from("ops_weekly_settings")
    .update({ rotation_anchor_week: anchorWeekStart, updated_by: admin.email })
    .eq("id", true)
    .select("id");
  if (res.error) return writeFailed("기준 주", res.error.message);
  if (!res.data || res.data.length === 0) {
    return failOf("설정 행이 없어 기준 주를 저장하지 못했습니다.");
  }
  return done();
}

export async function saveExcludedWriters(input: {
  emails: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = excludedWritersInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const res = await createAdminClient()
    .from("ops_weekly_settings")
    .update({
      excluded_writer_emails: [...new Set(parsed.data.emails)],
      updated_by: admin.email,
    })
    .eq("id", true)
    .select("id");
  if (res.error) return writeFailed("작성 제외", res.error.message);
  if (!res.data || res.data.length === 0) return failOf("설정 행이 없습니다.");
  return done();
}

/** 작성 포함 — 부장·팀장을 작성 대상에 넣는다. 목록을 통째로 받는다(작성 제외와 같은 모양). */
export async function saveIncludedWriters(input: {
  emails: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = includedWritersInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const res = await createAdminClient()
    .from("ops_weekly_settings")
    .update({
      included_writer_emails: [...new Set(parsed.data.emails)],
      updated_by: admin.email,
    })
    .eq("id", true)
    .select("id");
  if (res.error) return writeFailed("작성 포함", res.error.message);
  if (!res.data || res.data.length === 0) return failOf("설정 행이 없습니다.");
  return done();
}

export async function upsertProject(input: {
  id?: string;
  name: string;
  kind: ProjectKind;
  sortOrder: number;
  active: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const { id, name, kind, sortOrder, active } = parsed.data;
  const db = createAdminClient();
  const same = await db
    .from("ops_weekly_projects")
    .select("id")
    .eq("name", name);
  if (same.error) return writeFailed("항목", same.error.message);
  if ((same.data ?? []).some((r: { id: string }) => r.id !== id)) {
    return failOf(DUP_NAME);
  }
  const row = { name, kind, sort_order: sortOrder, active };
  const res = id
    ? await db.from("ops_weekly_projects").update(row).eq("id", id).select("id")
    : await db.from("ops_weekly_projects").insert(row).select("id");
  if (res.error) {
    return res.error.code === UNIQUE_VIOLATION
      ? failOf(DUP_NAME)
      : writeFailed("항목", res.error.message);
  }
  if (id && (!res.data || res.data.length === 0)) {
    return failOf("항목을 찾을 수 없습니다.");
  }
  return done();
}

export async function setProjectOwners(input: {
  projectId: string;
  emails: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = projectOwnersInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const { projectId } = parsed.data;
  const emails = [...new Set(parsed.data.emails)];
  const writers = await writerEmailSet();
  if (emails.some((e) => !writers.has(e))) return failOf(NOT_WRITER);
  const db = createAdminClient();
  const project = await db
    .from("ops_weekly_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (project.error) return writeFailed("담당자", project.error.message);
  if (!project.data) return failOf("항목을 찾을 수 없습니다.");
  const current = await db
    .from("ops_weekly_project_owners")
    .select("operator_email")
    .eq("project_id", projectId);
  if (current.error) return writeFailed("담당자", current.error.message);
  const existing = (current.data as { operator_email: string }[]).map((r) =>
    normEmail(r.operator_email),
  );
  // 추가 → 삭제 순서의 부분 갱신: 중간에 실패해도 담당자가 통째로 비지 않는다.
  const added = emails.filter((e) => !existing.includes(e));
  if (added.length > 0) {
    const ins = await db.from("ops_weekly_project_owners").upsert(
      added.map((e) => ({ project_id: projectId, operator_email: e })),
      { onConflict: "project_id,operator_email", ignoreDuplicates: true },
    );
    if (ins.error) return writeFailed("담당자", ins.error.message);
  }
  const removed = existing.filter((e) => !emails.includes(e));
  if (removed.length > 0) {
    const del = await db
      .from("ops_weekly_project_owners")
      .delete()
      .eq("project_id", projectId)
      .in("operator_email", removed);
    if (del.error) return writeFailed("담당자", del.error.message);
  }
  return done();
}

export async function setWeekDuty(input: {
  weekId: string;
  dutyEmail: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isFail(admin)) return admin;
  const parsed = weekDutyInputSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const { weekId, dutyEmail } = parsed.data;
  const week = await getWeekById(weekId);
  if (week === null) return failOf("주를 찾을 수 없습니다.");
  if (week.status !== "open") return failOf(DUTY_LOCKED);
  if (!(await writerEmailSet()).has(dutyEmail)) {
    return failOf("작성 명단에 없는 사람은 당번이 될 수 없습니다.");
  }
  // 그 주 행만 바꾼다. 상태를 where 에 걸어 그 사이 보고된 주는 0행이 된다.
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .update({ duty_email: dutyEmail })
    .eq("id", weekId)
    .eq("status", "open")
    .select("id");
  if (res.error) return writeFailed("당번", res.error.message);
  if (!res.data || res.data.length === 0) return failOf(DUTY_LOCKED);
  return done();
}
