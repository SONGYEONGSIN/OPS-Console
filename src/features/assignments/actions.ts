"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { fetchAssignmentSheet, SHEET_NAMES } from "./queries";
import { parseBaejungList, parseSimpleSheet, parsePims } from "./parse";
import type { AssignmentRecord } from "./schemas";
import { ASSIGNMENT_NATURAL_KEY } from "./ledger-schemas";
import {
  toLedgerRows,
  reconcile,
  ledgerKeyOf,
  type ImportIssue,
  type LedgerRowDraft,
  type ReconcileResult,
} from "./import";
import { listLedgerRows, type LedgerRow } from "./ledger-queries";

/**
 * 총괄장 시트 → 배정 원장 이관. **화면 교체(PR4) 전에 한 번 돈다**(설계 §9.1).
 *
 * **admin client 로 쓴다** — 원장에는 쓰기 정책이 아예 없고 `service_role` 에만
 * `grant all` 이 있다. 읽기는 `using (true)` 라 세션 클라이언트로 한다.
 *
 * 자연키 upsert 라 **몇 번 돌려도 행이 늘지 않는다.** 끝에 쓴 뒤의 원장을 다시
 * 읽어 대조 결과를 함께 돌려준다 — 건수만 맞다고 끝내면 어느 칸이 어긋났는지
 * 알 수 없다.
 */
export type ImportAssignmentsResult =
  | { ok: false; error: string }
  | {
      ok: true;
      /** 원장에 넣은 칸 수 */
      rows: number;
      /** 이력에 남긴 줄 수 */
      history: number;
      /** 이메일을 못 찾았거나 둘 이상에 걸린 이름 */
      unresolvedNames: string[];
      issues: ImportIssue[];
      reconcile: ReconcileResult;
    };

/** 한 번에 넣는 행 수. 설계가 세는 한 해 물량이 286대학 × 20칸 = 5,720행이다. */
const WRITE_CHUNK = 500;

/** 하위유형 없는 시트(03·06)의 헤더 규칙. 07 상담앱만 대학명 칸이 다르다. */
const SIMPLE_HEADERS = { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ };

/**
 * 다섯 시트 → 레코드. 하나도 못 읽으면 `null` 이다.
 *
 * ⚠️ 같은 파서 설정이 `app/dashboard/assignments/page.tsx` 와
 * `features/announcement-services/sync-operators.ts` 에도 있다 — 세 번째 복사다.
 * 헤더가 바뀌면 세 곳을 고쳐야 하니 단일 소스로 빼는 것이 맞지만, 이관 범위를
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

/**
 * 이름 → 이메일. **둘 이상에 걸리는 이름은 맞추지 않는다**(`null`).
 *
 * 하나를 골라 넣으면 틀린 사람에게 배정이 붙고, 그게 틀렸다는 것을 아무도 모른다.
 * 미매칭은 이름 스냅샷으로 드러나고 사람이 고친다(설계 F1·F2).
 */
function emailByName(operators: { email: string; name: string }[]) {
  const m = new Map<string, string | null>();
  for (const op of operators) {
    const name = op.name.trim();
    if (!name) continue;
    m.set(name, m.has(name) ? null : op.email);
  }
  return m;
}

function buildPayload(
  sheetRows: LedgerRowDraft[],
  byName: Map<string, string | null>,
  actorEmail: string,
) {
  const unresolved = new Set<string>();
  const payload = sheetRows.map((r) => {
    const email = byName.get(r.assignee_name) ?? null;
    if (!email) unresolved.add(r.assignee_name);
    return {
      academic_year: r.academic_year,
      university_name: r.university_name,
      work_kind: r.work_kind,
      subtype: r.subtype,
      role: r.role,
      assignee_email: email,
      assignee_name: r.assignee_name,
      university_type: r.university_type ?? null,
      updated_by: actorEmail,
    };
  });
  return { payload, unresolvedNames: [...unresolved] };
}

/**
 * 이력은 **바뀐 칸만**이고 **단위는 이메일**이다(마이그레이션 주석).
 *
 * 이메일을 못 맞춘 칸은 남기지 않는다 — `next_assignee` 가 null 이 되고 빈 칸이면
 * `prev` 도 null 이라 `assignment_changes_actual_change_chk` 가 23514 로 적재를
 * 통째로 죽인다. 이름 스냅샷은 원장의 `assignee_name` 에만 둔다.
 */
function buildHistory(
  sheetRows: LedgerRowDraft[],
  byName: Map<string, string | null>,
  prevByKey: Map<string, string | null>,
  actorEmail: string,
) {
  const out = [];
  for (const r of sheetRows) {
    const next = byName.get(r.assignee_name) ?? null;
    if (!next) continue;
    const prev = prevByKey.get(ledgerKeyOf(r)) ?? null;
    if (prev === next) continue;
    out.push({
      academic_year: r.academic_year,
      university_name: r.university_name,
      work_kind: r.work_kind,
      subtype: r.subtype,
      role: r.role,
      prev_assignee: prev,
      next_assignee: next,
      source: "import",
      actor_email: actorEmail,
    });
  }
  return out;
}

export async function importAssignments(
  academicYear: number,
): Promise<ImportAssignmentsResult> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 실행할 수 있습니다" };
  }
  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 9999
  ) {
    // 학년도가 자연키에 있어, 이상한 값은 아무도 안 보는 섬을 만든다.
    return { ok: false, error: `학년도가 이상합니다: ${academicYear}` };
  }

  const records = await readSheets();
  if (!records) return { ok: false, error: "총괄장을 읽지 못했습니다" };

  const { rows: sheetRows, issues } = toLedgerRows(records, academicYear);
  if (sheetRows.length === 0) {
    // 0건 성공으로 끝내면 '총괄장에 배정이 없다' 로 읽힌다.
    return { ok: false, error: "총괄장에서 배정 칸을 찾지 못했습니다" };
  }

  const admin = createAdminClient();
  const { data: ops, error: opsErr } = await admin
    .from("operators")
    .select("email, name");
  if (opsErr) {
    return { ok: false, error: `운영자 조회 실패: ${opsErr.message}` };
  }
  const byName = emailByName(
    (ops ?? []).map((o) => ({
      email: o.email as string,
      name: o.name as string,
    })),
  );

  // 쓰기 **전** 상태를 먼저 읽는다 — 이력은 '무엇이 바뀌었나' 로 정해진다.
  let before: LedgerRow[];
  try {
    before = await listLedgerRows(academicYear);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const prevByKey = new Map(
    before.map((r) => [ledgerKeyOf(r), r.assignee_email]),
  );

  const { payload, unresolvedNames } = buildPayload(
    sheetRows,
    byName,
    me.email,
  );
  for (let i = 0; i < payload.length; i += WRITE_CHUNK) {
    const { error } = await admin
      .from("assignments")
      .upsert(payload.slice(i, i + WRITE_CHUNK), {
        onConflict: ASSIGNMENT_NATURAL_KEY.join(","),
      });
    if (error) {
      return { ok: false, error: `원장 쓰기 실패: ${error.message}` };
    }
  }

  // 원장을 먼저 쓰고 이력을 뒤에 쓴다. PostgREST 는 호출 간 트랜잭션이 없어
  // 한쪽만 들어갈 수 있는데, 원장이 진실이고 이력은 부속이다. 이력만 실패한
  // 경우는 다시 돌려도 채워지지 않으므로(이전 상태가 이미 바뀌었다) 메시지로
  // 구분해 알린다.
  const history = buildHistory(sheetRows, byName, prevByKey, me.email);
  for (let i = 0; i < history.length; i += WRITE_CHUNK) {
    const { error } = await admin
      .from("assignment_changes")
      .insert(history.slice(i, i + WRITE_CHUNK));
    if (error) {
      return {
        ok: false,
        error: `원장은 들어갔지만 이력 적재가 실패했습니다: ${error.message}`,
      };
    }
  }

  let after: LedgerRow[];
  try {
    after = await listLedgerRows(academicYear);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/dashboard/assignments");

  return {
    ok: true,
    rows: payload.length,
    history: history.length,
    unresolvedNames,
    issues,
    reconcile: reconcile(sheetRows, after),
  };
}
