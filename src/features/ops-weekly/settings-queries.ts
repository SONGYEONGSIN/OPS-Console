import "server-only";

/**
 * 관리자 설정 조회 — admin client, 에러가 나면 던진다(빈 목록으로 삼키면 설정 화면이 '비어 있음'으로 거짓말한다).
 * 받는 사람 경고는 `warningFromOperators` 한 길이다 — addRecipient 도 같은 함수를 쓴다.
 */
import type { OperatorPermission } from "@/features/operators/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { WRITER_TEAMS, type ProjectKind } from "./constants";
import { normEmail } from "./email";
import {
  recipientWarning,
  writerRoster,
  type RecipientOperator,
  type RecipientWarning,
  type WriterCandidate,
} from "./roster";
import { rowsOf } from "./week-queries";

export type SettingsBundle = {
  recipients: {
    email: string;
    name: string | null;
    warning: RecipientWarning | null;
  }[];
  rotation: string[];
  anchorWeekStart: string | null;
  excludedWriterEmails: string[];
  writerCandidates: WriterCandidate[];
  /** 받는 사람 후보 — 운영1·2팀 활성 전원(부장·팀장 포함). 작성 명단과 달리 직급으로 빼지 않는다 */
  recipientCandidates: WriterCandidate[];
  projects: {
    id: string;
    name: string;
    kind: ProjectKind;
    sortOrder: number;
    active: boolean;
    owners: string[];
  }[];
};

export type OperatorLookup = RecipientOperator & { name: string | null };

type OperatorDbRow = {
  email: string;
  name: string | null;
  status: string;
  permission: OperatorPermission | null;
  allowed_menus: string[] | null;
};

/** 운영자 전체(소규모 표) — 이메일 대소문자가 섞여 있어도 정규화한 키로 맞춘다. */
export async function listOperatorLookups(): Promise<OperatorLookup[]> {
  const res = await createAdminClient()
    .from("operators")
    .select("email, name, status, permission, allowed_menus");
  return rowsOf<OperatorDbRow>("operators", res).map((r) => ({
    email: normEmail(r.email),
    name: r.name,
    status: r.status,
    permission: r.permission ?? null,
    allowed_menus: r.allowed_menus ?? [],
  }));
}

export function warningFromOperators(
  operators: readonly OperatorLookup[],
  email: string,
): { name: string | null; warning: RecipientWarning | null } {
  const key = normEmail(email);
  const row = operators.find((o) => o.email === key) ?? null;
  return { name: row?.name ?? null, warning: recipientWarning(row) };
}

/** A2 가 [최종 보고] 메일 수신자로 쓴다. */
export async function listRecipients(): Promise<string[]> {
  const res = await createAdminClient()
    .from("ops_weekly_recipients")
    .select("email")
    .order("email", { ascending: true });
  // 정규화한 뒤 다시 정렬한다 — DB 정렬은 대소문자가 섞인 원본 기준이다.
  return rowsOf<{ email: string }>("ops_weekly_recipients", res)
    .map((r) => normEmail(r.email))
    .sort();
}

/**
 * 이 사람이 받는 사람인가 — 명단 정규화는 `listRecipients` 한 길로 하고 불리언만 내보낸다
 * (명단은 화면에 내리지 않는다). 조회 실패는 false 가 아니라 던진다.
 */
export async function isRecipient(email: string): Promise<boolean> {
  return (await listRecipients()).includes(normEmail(email));
}

type SettingsDbRow = {
  rotation_anchor_week: string | null;
  excluded_writer_emails: string[] | null;
};

async function readSettings() {
  const res = await createAdminClient()
    .from("ops_weekly_settings")
    .select("rotation_anchor_week, excluded_writer_emails")
    .eq("id", true)
    .maybeSingle();
  if (res.error) {
    throw new Error(`[ops-weekly] ops_weekly_settings: ${res.error.message}`);
  }
  const row = res.data as SettingsDbRow | null;
  return {
    anchor: row?.rotation_anchor_week ?? null,
    excluded: (row?.excluded_writer_emails ?? []).map(normEmail),
  };
}

/** 제외를 반영하기 **전** 명단 — 제외 체크박스용. */
async function listTeamOperators(): Promise<WriterCandidate[]> {
  const res = await createAdminClient()
    .from("operators")
    .select("email, name, team, role, status")
    .in("team", [...WRITER_TEAMS])
    .eq("status", "active");
  return rowsOf<WriterCandidate>("operators", res).map((r) => ({
    ...r,
    email: normEmail(r.email),
    name: r.name.trim(),
  }));
}

async function listRotation(): Promise<string[]> {
  const res = await createAdminClient()
    .from("ops_weekly_duty_rotation")
    .select("position, operator_email")
    .order("position", { ascending: true });
  return rowsOf<{ operator_email: string }>(
    "ops_weekly_duty_rotation",
    res,
  ).map((r) => normEmail(r.operator_email));
}

type ProjectDbRow = {
  id: string;
  name: string;
  kind: ProjectKind;
  sort_order: number;
  active: boolean;
};

async function listProjects(): Promise<SettingsBundle["projects"]> {
  const db = createAdminClient();
  const projects = rowsOf<ProjectDbRow>(
    "ops_weekly_projects",
    await db
      .from("ops_weekly_projects")
      .select("id, name, kind, sort_order, active")
      .order("sort_order", { ascending: true }),
  );
  const owners = rowsOf<{ project_id: string; operator_email: string }>(
    "ops_weekly_project_owners",
    await db
      .from("ops_weekly_project_owners")
      .select("project_id, operator_email"),
  );
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    sortOrder: p.sort_order,
    active: p.active,
    owners: owners
      .filter((o) => o.project_id === p.id)
      .map((o) => normEmail(o.operator_email)),
  }));
}

export async function loadSettingsBundle(): Promise<SettingsBundle> {
  const [recipientEmails, operators, rotation, settings, candidates, projects] =
    await Promise.all([
      listRecipients(),
      listOperatorLookups(),
      listRotation(),
      readSettings(),
      listTeamOperators(),
      listProjects(),
    ]);
  return {
    recipients: recipientEmails.map((email) => ({
      email,
      ...warningFromOperators(operators, email),
    })),
    rotation,
    anchorWeekStart: settings.anchor,
    excludedWriterEmails: settings.excluded,
    writerCandidates: writerRoster(candidates, []),
    recipientCandidates: candidates,
    projects,
  };
}
