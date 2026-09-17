"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { fetchAssignmentSheet, SHEET_NAMES } from "./queries";
import {
  ASSIGNMENT_NATURAL_KEY,
  assignmentChangeIdSchema,
  assignmentUpdateSchema,
  type AssignmentCellInput,
  type AssignmentRole,
  type AssignmentWorkKind,
} from "./ledger-schemas";
import { parseBaejungList, parseSimpleSheet, parsePims } from "./parse";
import type { AssignmentRecord } from "./schemas";
import {
  toLedgerRows,
  reconcile,
  type ImportIssue,
  type ReconcileResult,
} from "./import";
import { listLedgerRows, type LedgerRow } from "./ledger-queries";

/**
 * 총괄장 시트 ↔ 배정 원장 **대조**. 읽기만 한다.
 *
 * 원래 여기 있던 이관(쓰기)은 PR4 에서 걷었다(설계 §14). 편집이 앱에서 일어나기
 * 시작하면 자연키 upsert 가 **시트에 있는 모든 칸을 시트 값으로 되돌리고**, 그
 * 덮어씀이 `assignment_changes` 에 정당한 변경으로 남아 되돌릴 수도 사고로 구분할
 * 수도 없게 된다. 게다가 쓰기 뒤에 견주면 방금 덮어쓴 원장과 시트를 비교하니
 * **대조가 0건으로 통과한다** — 대조는 양쪽이 같은 원천에서 나오면 눈이 먼다.
 *
 * **admin 클라이언트를 만들지 않는 것이 곧 쓸 수 없다는 증거다.** 원장에는 쓰기
 * 정책이 없고 `service_role` 에만 `grant all` 이 있어, 세션 클라이언트로는 문법이
 * 맞아도 0행이 바뀐다. 시트를 방치해도(열린 질문 3) 갈림은 여기서 드러난다.
 */
export type ReconcileAssignmentsResult =
  | { ok: false; error: string }
  | { ok: true; issues: ImportIssue[]; reconcile: ReconcileResult };

/** 하위유형 없는 시트(03·06)의 헤더 규칙. 07 상담앱만 대학명 칸이 다르다. */
const SIMPLE_HEADERS = { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ };

/**
 * 다섯 시트 → 레코드. 하나도 못 읽으면 `null` 이다.
 *
 * ⚠️ 같은 파서 설정이 `app/dashboard/assignments/page.tsx` 와
 * `features/announcement-services/sync-operators.ts` 에도 있다 — 세 번째 복사다.
 * 헤더가 바뀌면 세 곳을 고쳐야 하니 단일 소스로 빼는 것이 맞지만, 이 PR 범위를
 * 넘으므로 별도 PR 로 남긴다.
 */
async function readSheets(): Promise<AssignmentRecord[] | null> {
  const [baejung, grad, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);
  if (!baejung && !grad && !pims && !sungjuk && !sangdam) return null;

  return [
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(grad ? parseSimpleSheet(grad, "대학원", SIMPLE_HEADERS) : []),
    ...(pims ? parsePims(pims) : []),
    ...(sungjuk ? parseSimpleSheet(sungjuk, "성적산출", SIMPLE_HEADERS) : []),
    ...(sangdam
      ? parseSimpleSheet(sangdam, "상담앱", {
          uni: /학교명|대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
  ];
}

export async function reconcileAssignments(
  academicYear: number,
): Promise<ReconcileAssignmentsResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 실행할 수 있습니다" };
  }
  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 9999
  ) {
    // 학년도가 자연키에 있어, 이상한 값은 아무도 안 보는 섬과 대조하게 된다.
    return { ok: false, error: `학년도가 이상합니다: ${academicYear}` };
  }

  const records = await readSheets();
  if (!records) return { ok: false, error: "총괄장을 읽지 못했습니다" };

  const { rows: sheetRows, issues } = toLedgerRows(records, academicYear);
  if (sheetRows.length === 0) {
    // 0건 성공으로 끝내면 '시트와 원장이 같다' 로 읽힌다.
    return { ok: false, error: "총괄장에서 배정 칸을 찾지 못했습니다" };
  }

  // 조회 실패를 빈 배열로 삼키지 않는다 — 삼키면 시트 전량이 '원장에 없음' 으로
  // 나와, 사람은 멀쩡히 들어간 원장을 의심한다.
  let ledger: LedgerRow[];
  try {
    ledger = await listLedgerRows(academicYear);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return { ok: true, issues, reconcile: reconcile(sheetRows, ledger) };
}

/**
 * 배정 편집 — 한 대학의 칸 여러 개를 한 번에 저장한다.
 *
 * **서버가 폼을 믿지 않는다.** 폼은 이 칸의 현재 담당자를 함께 보내지만, 그 화면이
 * 열린 뒤에 다른 사람이 같은 칸을 고쳤을 수 있다. 폼이 보낸 이전값으로 이력을 남기면
 * **실제로 일어난 적 없는 변경**이 이력에 박히고, 되돌리기가 그 거짓을 되돌린다.
 * 그래서 이전값은 DB 에서 다시 읽고, 바뀐 칸만 쓴다.
 *
 * 입력이 `unknown` 인 것은 여기가 경계이기 때문이다 — 클라이언트는 무엇이든 보낼 수
 * 있고, 어휘를 지키는 것은 zod 뿐이다(DB 에는 `work_kind` check 가 없다).
 *
 * **담당자 교체·비우기만 한다.** 원장에 없는 칸(새 하위유형)은 거부한다 — 만들려면
 * (업무종류 × 하위유형) 유효 조합 표가 먼저 필요하고, 그것 없이 열면 오타가 아무도
 * 안 보는 칸을 만든다.
 */
export type UpdateAssignmentResult =
  { ok: false; error: string } | { ok: true; changed: number; history: number };

/** 자연키에서 학년도·대학명을 뺀 나머지 — 한 대학 안에서 칸을 가르는 키다. */
const cellKeyOf = (c: {
  work_kind: string;
  subtype: string;
  role: string;
}): string => [c.work_kind, c.subtype, c.role].join("|");

const cellLabel = (c: {
  work_kind: string;
  subtype: string;
  role: string;
}): string => `${c.work_kind}${c.subtype ? ` · ${c.subtype}` : ""} · ${c.role}`;

export async function updateAssignment(
  raw: unknown,
): Promise<UpdateAssignmentResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 배정을 고칠 수 있습니다" };
  }
  const parsed = assignmentUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { academic_year, university_name, cells } = parsed.data;

  const admin = createAdminClient();

  const { data: current, error: readErr } = await admin
    .from("assignments")
    .select("work_kind, subtype, role, assignee_email, assignee_name")
    .eq("academic_year", academic_year)
    .eq("university_name", university_name);
  if (readErr) {
    return { ok: false, error: `원장 조회 실패: ${readErr.message}` };
  }

  const byKey = new Map(
    (current ?? []).map((r) => [
      cellKeyOf({
        work_kind: r.work_kind as string,
        subtype: (r.subtype as string | null) ?? "",
        role: r.role as string,
      }),
      {
        email: (r.assignee_email as string | null) ?? null,
        name: (r.assignee_name as string | null) ?? "",
      },
    ]),
  );

  const pending: { cell: AssignmentCellInput; prevEmail: string | null }[] = [];
  for (const cell of cells) {
    const cur = byKey.get(cellKeyOf(cell));
    if (!cur) {
      return { ok: false, error: `원장에 없는 칸입니다: ${cellLabel(cell)}` };
    }
    if (cur.email === cell.assignee_email && cur.name === cell.assignee_name) {
      continue;
    }
    pending.push({ cell, prevEmail: cur.email });
  }
  // 바뀐 것이 없으면 쓰지 않는다 — 저장을 두 번 눌러도 이력이 늘지 않는다.
  if (pending.length === 0) return { ok: true, changed: 0, history: 0 };

  /**
   * 새로 붙는 주소는 **명부에 있어야 한다.** FK 가 `23503` 으로 막지만 그 코드는
   * 사람이 못 읽는다 — 먼저 보고 말로 돌려준다(설계 F14). 이름 스냅샷도 여기서
   * 가져온다: 폼이 낡은 이름을 들고 있을 수 있고, 그러면 화면이 한 사람을 두 이름으로
   * 부른다.
   */
  const emails = [
    ...new Set(
      pending
        .map((p) => p.cell.assignee_email)
        .filter((e): e is string => e !== null),
    ),
  ];
  const nameByEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data: ops, error } = await admin
      .from("operators")
      .select("email, name")
      .in("email", emails);
    if (error) {
      return { ok: false, error: `운영자 조회 실패: ${error.message}` };
    }
    for (const o of ops ?? []) {
      nameByEmail.set(o.email as string, (o.name as string | null) ?? "");
    }
    const missing = emails.filter((e) => !nameByEmail.has(e));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `연결 안 됨 — 운영자 명부에 없는 주소입니다: ${missing.join(", ")}`,
      };
    }
  }

  const payload = pending.map(({ cell }) => ({
    academic_year,
    university_name,
    work_kind: cell.work_kind,
    subtype: cell.subtype,
    role: cell.role,
    assignee_email: cell.assignee_email,
    // 이메일이 있으면 이름은 명부에서. 개발 칸은 이메일이 없어 폼의 자유 입력이다.
    assignee_name: cell.assignee_email
      ? (nameByEmail.get(cell.assignee_email) ?? "")
      : cell.assignee_name,
    updated_by: me.email,
  }));
  const { error: writeErr } = await admin
    .from("assignments")
    .upsert(payload, { onConflict: ASSIGNMENT_NATURAL_KEY.join(",") });
  if (writeErr) {
    return { ok: false, error: `원장 쓰기 실패: ${writeErr.message}` };
  }

  /**
   * 이력은 **이메일이 바뀐 칸만**이다. 개발 칸은 이메일이 없어 여기 오지 않는다
   * (사용자 결정 2026-09-17) — 남기려 하면 `prev=next=null` 이 되어
   * `assignment_changes_actual_change_chk` 가 `23514` 로 적재를 통째로 죽인다.
   *
   * 원장을 먼저 쓰고 이력을 뒤에 쓴다. PostgREST 는 호출 간 트랜잭션이 없어 한쪽만
   * 들어갈 수 있는데, 원장이 진실이고 이력은 부속이다. 이력만 실패한 경우는 다시
   * 눌러도 채워지지 않으므로(이전 상태가 이미 바뀌었다) 메시지로 구분해 알린다.
   */
  const history = pending
    .filter(({ cell, prevEmail }) => prevEmail !== cell.assignee_email)
    .map(({ cell, prevEmail }) => ({
      academic_year,
      university_name,
      work_kind: cell.work_kind,
      subtype: cell.subtype,
      role: cell.role,
      prev_assignee: prevEmail,
      next_assignee: cell.assignee_email,
      source: "manual",
      actor_email: me.email,
    }));
  if (history.length > 0) {
    const { error } = await admin.from("assignment_changes").insert(history);
    if (error) {
      return {
        ok: false,
        error: `원장은 들어갔지만 이력 적재가 실패했습니다: ${error.message}`,
      };
    }
  }

  revalidatePath("/dashboard/assignments");
  return { ok: true, changed: payload.length, history: history.length };
}

/**
 * 배정 변경 한 줄 되돌리기.
 *
 * **되돌리기는 삭제가 아니다**(마이그레이션 주석). 원장을 `prev_assignee` 로 바꾸고
 * `source='revert'` 인 **새 이력 행**을 남긴다 — 이력을 지우는 경로는 만들지 않는다.
 * 지우면 "이 칸이 왜 이 사람인가" 를 설명할 수 없고, 되돌리기를 되돌릴 수도 없다.
 *
 * 되돌릴 수 없는 경우가 둘이다. **되돌릴 주소가 `operators` 에 없으면**(F14: 이메일
 * 변경으로 FK 가 cascade 된 뒤, 또는 계정이 지워진 뒤) 그대로 쓰면 `23503` 이다.
 * **그 변경 뒤에 누가 또 고쳤으면** 되돌리기가 남의 변경을 말없이 덮는다.
 */
export type RevertChangeResult = { ok: false; error: string } | { ok: true };

export async function revertChange(
  changeId: string,
): Promise<RevertChangeResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 되돌릴 수 있습니다" };
  }
  if (!assignmentChangeIdSchema.safeParse(changeId).success) {
    return { ok: false, error: "이력 id 가 이상합니다" };
  }

  const admin = createAdminClient();

  const { data: change, error: changeErr } = await admin
    .from("assignment_changes")
    .select(
      "id, academic_year, university_name, work_kind, subtype, role, prev_assignee, next_assignee",
    )
    .eq("id", changeId)
    .maybeSingle();
  if (changeErr) {
    return { ok: false, error: `이력 조회 실패: ${changeErr.message}` };
  }
  if (!change) return { ok: false, error: "이력을 찾지 못했습니다" };

  const cell = {
    work_kind: change.work_kind as AssignmentWorkKind,
    subtype: (change.subtype as string | null) ?? "",
    role: change.role as AssignmentRole,
  };
  const academic_year = change.academic_year as number;
  const university_name = change.university_name as string;
  const prevAssignee = (change.prev_assignee as string | null) ?? null;
  const nextAssignee = (change.next_assignee as string | null) ?? null;

  const { data: current, error: readErr } = await admin
    .from("assignments")
    .select("work_kind, subtype, role, assignee_email, assignee_name")
    .eq("academic_year", academic_year)
    .eq("university_name", university_name);
  if (readErr) {
    return { ok: false, error: `원장 조회 실패: ${readErr.message}` };
  }

  const cur = (current ?? []).find(
    (r) =>
      cellKeyOf({
        work_kind: r.work_kind as string,
        subtype: (r.subtype as string | null) ?? "",
        role: r.role as string,
      }) === cellKeyOf(cell),
  );
  if (!cur) {
    return {
      ok: false,
      error: `원장에서 칸이 사라졌습니다: ${cellLabel(cell)}`,
    };
  }
  if (((cur.assignee_email as string | null) ?? null) !== nextAssignee) {
    return {
      ok: false,
      error:
        "그 뒤에 이 칸이 또 바뀌었습니다 — 최신 변경부터 차례로 되돌려야 합니다",
    };
  }

  // 되돌릴 주소가 명부에 있어야 한다(F14). 이름 스냅샷도 그 시점이 아니라
  // **지금의 이름**이다 — 원장은 현재 상태를 보여주는 표다.
  let name = "";
  if (prevAssignee !== null) {
    const { data: ops, error } = await admin
      .from("operators")
      .select("email, name")
      .in("email", [prevAssignee]);
    if (error) {
      return { ok: false, error: `운영자 조회 실패: ${error.message}` };
    }
    const found = (ops ?? [])[0];
    if (!found) {
      return {
        ok: false,
        error: `연결 안 됨 — 되돌릴 주소가 운영자 명부에 없습니다: ${prevAssignee}`,
      };
    }
    name = (found.name as string | null) ?? "";
  }

  const { error: writeErr } = await admin.from("assignments").upsert(
    [
      {
        academic_year,
        university_name,
        work_kind: cell.work_kind,
        subtype: cell.subtype,
        role: cell.role,
        assignee_email: prevAssignee,
        assignee_name: name,
        updated_by: me.email,
      },
    ],
    { onConflict: ASSIGNMENT_NATURAL_KEY.join(",") },
  );
  if (writeErr) {
    return { ok: false, error: `원장 쓰기 실패: ${writeErr.message}` };
  }

  const { error: histErr } = await admin.from("assignment_changes").insert([
    {
      academic_year,
      university_name,
      work_kind: cell.work_kind,
      subtype: cell.subtype,
      role: cell.role,
      prev_assignee: nextAssignee,
      next_assignee: prevAssignee,
      source: "revert",
      actor_email: me.email,
    },
  ]);
  if (histErr) {
    return {
      ok: false,
      error: `원장은 되돌렸지만 이력 적재가 실패했습니다: ${histErr.message}`,
    };
  }

  revalidatePath("/dashboard/assignments");
  return { ok: true };
}
