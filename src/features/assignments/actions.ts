"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { WORK_ASSIGNMENT_PATH } from "./paths";
import { fetchAssignmentSheet, SHEET_NAMES } from "./queries";
import {
  ASSIGNMENT_NATURAL_KEY,
  assignmentChangeIdSchema,
  assignmentUpdateSchema,
  type AssignmentCellInput,
  type AssignmentRole,
  type AssignmentWorkKind,
} from "./ledger-schemas";
import { recordsFromSheets } from "./sheet-records";
import type { AssignmentRecord } from "./schemas";
import {
  toLedgerRows,
  reconcile,
  linkAssignees,
  ledgerKeyOf,
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

/**
 * 다섯 시트 → 그 학년도 레코드. 하나도 못 읽으면 `null` 이다.
 *
 * 어느 칸을 읽을지는 `sheet-records.ts` 가 정한다 — 시트가 올해와 전년도를 함께
 * 들고 있어서(`前 운영자`), 학년도별 헤더 규칙이 두 곳에 있으면 한쪽만 고쳐지는 날
 * **작년 자리에 올해 이름이 들어간다.**
 *
 * ⚠️ 비슷한 파서 설정이 `features/announcement-services/sync-operators.ts` 에도
 * 있다(세 시트 · 올해 이름만). 합칠 수 있지만 이 PR 범위를 넘으므로 남긴다.
 */
async function readSheets(
  academicYear: number,
): Promise<AssignmentRecord[] | null> {
  const [baejung, grad, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);
  if (!baejung && !grad && !pims && !sungjuk && !sangdam) return null;

  return recordsFromSheets(
    {
      배정리스트: baejung,
      대학원: grad,
      PIMS: pims,
      성적산출: sungjuk,
      상담앱: sangdam,
    },
    academicYear,
  );
}

/** 학년도 위생. 자연키에 학년도가 있어, 이상한 값은 아무도 안 보는 섬을 만든다. */
function badYear(academicYear: number): string | null {
  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 9999
  ) {
    return `학년도가 이상합니다: ${academicYear}`;
  }
  return null;
}

export async function reconcileAssignments(
  academicYear: number,
): Promise<ReconcileAssignmentsResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 실행할 수 있습니다" };
  }
  const yearError = badYear(academicYear);
  if (yearError) return { ok: false, error: yearError };

  // 그 학년도의 칸을 읽는다 — 시트가 올해와 전년도를 함께 들고 있다.
  const records = await readSheets(academicYear);
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
 * 이관 결과. **넣은 것과 건너뛴 것을 따로 센다** — 합만 보여주면 두 번째 실행이
 * 성공인지 아무 일도 안 한 것인지 구분되지 않는다.
 */
export type ImportAssignmentsResult =
  | { ok: false; error: string }
  | {
      ok: true;
      /** 새로 만든 칸. */
      inserted: number;
      /** 이미 원장에 있어 **건드리지 않은** 칸. */
      skipped: number;
      /** 담당자 이메일이 붙은 칸. 나머지는 이름만 들어간다. */
      linked: number;
      /** 동명이인이라 잇지 못한 이름. 사람이 골라야 한다. */
      ambiguousNames: string[];
      issues: ImportIssue[];
    };

/** PostgREST 한 번에 밀 행 수. 통째로 밀면 요청 하나가 전량을 실패시킨다. */
const WRITE_CHUNK = 500;

const chunk = <T>(rows: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

/**
 * 총괄장 시트 → 배정 원장 **이관**. 시트에 있고 원장에 **없는** 칸만 만든다.
 *
 * 설계 §13 R1 은 재가져오기를 만들지 않기로 했다(사용자 결정 2026-09-15). 자연키
 * upsert 가 **앱에서 고친 배정을 시트 값으로 되돌리고**, 그 덮어씀이 `assignment_changes`
 * 에 정당한 변경으로 남아 되돌릴 수도 사고로 구분할 수도 없기 때문이다. 게다가 대조는
 * 쓰기 뒤에 돌면 방금 덮어쓴 원장과 시트를 비교해 **0건으로 통과한다.**
 *
 * 그래서 이것은 재가져오기가 아니고, **그럴 수 없는 모양**이다:
 * `ignoreDuplicates` 가 `ON CONFLICT DO NOTHING` 이라 이미 있는 칸은 DB 가 안 받는다.
 * 조심해서 안 덮는 게 아니라 못 덮는다. 덕분에 셋이 따라온다 —
 * 앱 편집이 안전하고(비운 칸도 되살지 않는다), 대조가 `nameMismatch` 로 갈림을 계속
 * 드러내고, 반쯤 들어간 뒤 다시 눌러도 된다.
 *
 * 쓰는 것은 **전년도를 원장에 앉히기 위해서**다(사용자 결정 2026-09-22). 예전 화면은
 * 과거 배분현황을 `services.operator_email` 로 우회했는데, 그건 2026-02-28 에 멈춘
 * 시트 임포트라 원장 이름과 표기가 갈렸다. 전년도 칸은 시트에 이미 있다(`前 운영자`).
 */
export async function importAssignments(
  academicYear: number,
): Promise<ImportAssignmentsResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 이관할 수 있습니다" };
  }
  const yearError = badYear(academicYear);
  if (yearError) return { ok: false, error: yearError };

  const records = await readSheets(academicYear);
  if (!records) return { ok: false, error: "총괄장을 읽지 못했습니다" };

  const { rows: sheetRows, issues } = toLedgerRows(records, academicYear);
  if (sheetRows.length === 0) {
    /*
     * 0건 성공으로 끝내면 '이관할 게 없다' 로 읽힌다. 실제로는 시트에 그 학년도
     * 칸이 없는 것이고(`sheet-records` 가 모르는 해는 빈 배열이다), 그건 버튼을
     * 잘못 눌렀다는 뜻이다.
     */
    return {
      ok: false,
      error: `총괄장에서 ${academicYear}학년도 배정 칸을 찾지 못했습니다`,
    };
  }

  /*
   * 원장 조회 실패를 빈 배열로 삼키면 **이미 들어간 칸을 전부 다시 넣으려 한다.**
   * `DO NOTHING` 이 막아 주기는 하지만 결과가 '새로 1,800건' 으로 보고되어,
   * 사람은 일어나지 않은 일을 일어났다고 읽는다.
   */
  let ledger: LedgerRow[];
  try {
    ledger = await listLedgerRows(academicYear);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const have = new Set(ledger.map(ledgerKeyOf));
  const fresh = sheetRows.filter((r) => !have.has(ledgerKeyOf(r)));
  const skipped = sheetRows.length - fresh.length;

  if (fresh.length === 0) {
    return {
      ok: true,
      inserted: 0,
      skipped,
      linked: 0,
      ambiguousNames: [],
      issues,
    };
  }

  const admin = createAdminClient();

  /*
   * **명부를 상태로 좁히지 않는다.** 작년 담당자는 이미 그만뒀을 수 있고, FK 가 보는
   * 것은 `operators` 에 있는가뿐이다. active 만 읽으면 퇴사자가 맡았던 칸이 통째로
   * 이름만 남아, 그 사람의 작년 부하가 화면에서 사라진다.
   */
  const { data: ops, error: opsErr } = await admin
    .from("operators")
    .select("email, name");
  if (opsErr) {
    // 삼키면 전량이 이름만으로 들어가고, 그 뒤엔 `DO NOTHING` 때문에 고칠 수 없다.
    return { ok: false, error: `운영자 조회 실패: ${opsErr.message}` };
  }
  const { rows: linkedRows, ambiguousNames } = linkAssignees(
    fresh,
    (ops ?? []).map((o) => ({
      email: o.email as string,
      name: (o.name as string | null) ?? "",
    })),
  );

  const payload = linkedRows.map((r) => ({
    academic_year: r.academic_year,
    university_name: r.university_name,
    work_kind: r.work_kind,
    subtype: r.subtype,
    role: r.role,
    assignee_email: r.assignee_email,
    assignee_name: r.assignee_name,
    university_type: r.university_type ?? null,
    // 누른 사람이다. 'import' 같은 가짜 주소를 넣으면 나중에 물을 곳이 없다.
    updated_by: me.email,
  }));

  for (const part of chunk(payload, WRITE_CHUNK)) {
    const { error } = await admin
      .from("assignments")
      .upsert(part, {
        onConflict: ASSIGNMENT_NATURAL_KEY.join(","),
        // **이 한 줄이 재가져오기가 아니라는 보증이다**(위 설명).
        ignoreDuplicates: true,
      });
    if (error) {
      return { ok: false, error: `원장 쓰기 실패: ${error.message}` };
    }
  }

  /**
   * 이력은 **이메일이 붙은 칸만**이다. 이름만 있는 칸은 `prev=next=null` 이 되어
   * `assignment_changes_actual_change_chk` 가 `23514` 로 적재를 통째로 죽인다.
   *
   * `prev_assignee` 는 null 이다 — 없던 칸이 생긴 것이라 이전 담당자가 없다.
   * 2027 이관 행 966개가 이미 그 모양이고, 되돌리기가 그것을 받는다.
   */
  const history = payload
    .filter((r) => r.assignee_email !== null)
    .map((r) => ({
      academic_year: r.academic_year,
      university_name: r.university_name,
      work_kind: r.work_kind,
      subtype: r.subtype,
      role: r.role,
      prev_assignee: null,
      next_assignee: r.assignee_email,
      source: "import",
      actor_email: me.email,
    }));
  for (const part of chunk(history, WRITE_CHUNK)) {
    const { error } = await admin.from("assignment_changes").insert(part);
    if (error) {
      return {
        ok: false,
        error: `원장은 들어갔지만 이력 적재가 실패했습니다: ${error.message}`,
      };
    }
  }

  revalidatePath("/dashboard/assignments");
  revalidatePath(WORK_ASSIGNMENT_PATH);
  return {
    ok: true,
    inserted: payload.length,
    skipped,
    linked: history.length,
    ambiguousNames,
    issues,
  };
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
  revalidatePath(WORK_ASSIGNMENT_PATH);
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
  revalidatePath(WORK_ASSIGNMENT_PATH);
  return { ok: true };
}
