import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AssignmentChange,
  AssignmentChangeSource,
  AssignmentRole,
  AssignmentWorkKind,
} from "./ledger-schemas";

/**
 * 원장 한 행 = 시트 쪽 초안 + **이메일**.
 *
 * 이력의 단위가 이메일이라(마이그레이션 주석) 이력 비교에 이 칸이 필요하다 —
 * 이름만 비교하면 운영자 메일이 바뀐 경우를 '안 바뀜' 으로 읽는다. `LedgerRowDraft`
 * 를 넓힌 모양이라 `reconcile` 에는 그대로 넘어간다.
 */
import type { LedgerRow } from "./import";
export type { LedgerRow };

/** PostgREST Max-Rows cap. 한 번만 조회하면 뒤쪽 배정이 조용히 사라진다. */
const CHUNK = 1000;
const MAX_PAGES = 20;

/**
 * 배정 원장 읽기 — **대조의 한쪽 입력**이다. 시트 쪽은 `toLedgerRows` 가 만들고
 * 이쪽은 DB 가 만든다. 두 배열이 같은 모양이라 `reconcile` 이 그대로 먹는다.
 *
 * 세션 클라이언트다. 원장의 select 정책이 `using (true)` 라 로그인한 사람 누구나
 * 읽는다 — admin 클라이언트는 쓰기에만 쓴다(원장에 쓰기 정책이 없다).
 *
 * **조회 실패를 빈 배열로 삼키지 않는다.** supabase-js 는 던지지 않으므로 여기서
 * 삼키면 대조가 시트 전량을 '원장에 없음' 으로 세고, 사람은 멀쩡히 들어간 이관을
 * 실패로 읽어 다시 돌린다. 목록 화면이라면 빈 배열이 낫지만(`listOperators`),
 * 이건 안전장치라 조용한 0건이 곧 거짓말이다.
 */
export async function listLedgerRows(
  academicYear: number,
): Promise<LedgerRow[]> {
  const supabase = await createClient();
  const out: LedgerRow[] = [];

  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from("assignments")
      .select(
        "academic_year, university_name, work_kind, subtype, role, assignee_email, assignee_name, university_type",
      )
      .eq("academic_year", academicYear)
      .range(p * CHUNK, p * CHUNK + CHUNK - 1);
    if (error) {
      throw new Error(`[assignments] 원장 조회 실패: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    out.push(
      ...data.map((r) => ({
        academic_year: r.academic_year as number,
        university_name: r.university_name as string,
        // 어휘 밖 값이 와도 빼지 않는다 — 빼면 원장이 줄어 보인다. 시트에 없는
        // 키이므로 대조가 '원장에만 있음' 으로 드러내고, 그게 맞는 보고다.
        work_kind: r.work_kind as AssignmentWorkKind,
        subtype: (r.subtype as string | null) ?? "",
        role: r.role as AssignmentRole,
        assignee_email: (r.assignee_email as string | null) ?? null,
        assignee_name: (r.assignee_name as string | null) ?? "",
        university_type: (r.university_type as string | null) ?? undefined,
      })),
    );
    if (data.length < CHUNK) break;
  }
  return out;
}

/**
 * 한 번에 읽는 이력 페이지 상한. **넘기면 던진다** — 상한에서 조용히 멈추면 오래된
 * 이력이 사라진 것처럼 보이고, 그 자리에서 되돌리기를 누른 사람은 자기가 무엇을
 * 되돌리는지 모른다. 30대학 × 20칸 × 편집 33번이면 닿는다.
 */
const HISTORY_MAX_PAGES = 20;

/** 이력 조회 컬럼 — `id` 가 없으면 되돌리기가 무엇을 되돌릴지 가리킬 수 없다. */
const CHANGE_COLUMNS =
  "id, academic_year, university_name, work_kind, subtype, role, prev_assignee, next_assignee, source, actor_email, changed_at";

/**
 * 배정 변경 이력 — **인스펙터가 '이 칸이 왜 이 사람인가' 를 답하는 근거**다.
 *
 * **화면에 뜬 대학만 읽는다.** 학년도 전체를 읽으면 편집이 쌓일수록 목록 한 장을
 * 그리는 비용이 자라고, 한 대학의 세 줄을 보여주려고 수천 줄을 클라이언트로 보낸다.
 * 대학 목록이 비면 아예 조회하지 않는다 — 빈 `in` 은 전건 조회로 둔갑한다.
 *
 * 세션 클라이언트다. `assignment_changes_select` 가 `using (true)` 라 로그인한
 * 사람 누구나 읽는다(오늘 총괄장이 전원 공개다). admin 클라이언트는 되돌리기
 * 쓰기에만 쓴다.
 */
export async function listAssignmentChanges(
  academicYear: number,
  universityNames: readonly string[],
): Promise<AssignmentChange[]> {
  if (universityNames.length === 0) return [];

  const supabase = await createClient();
  const out: AssignmentChange[] = [];

  for (let p = 0; p < HISTORY_MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from("assignment_changes")
      .select(CHANGE_COLUMNS)
      .eq("academic_year", academicYear)
      .in("university_name", [...universityNames])
      // 최신 변경이 먼저다 — 되돌릴 대상은 맨 위 한 줄이다.
      .order("changed_at", { ascending: false })
      .range(p * CHUNK, p * CHUNK + CHUNK - 1);
    if (error) {
      throw new Error(`[assignments] 이력 조회 실패: ${error.message}`);
    }
    if (!data || data.length === 0) return out;
    out.push(
      ...data.map((r) => ({
        id: r.id as string,
        academic_year: r.academic_year as number,
        university_name: r.university_name as string,
        work_kind: r.work_kind as AssignmentWorkKind,
        // 자연키를 되만들 때 `null` 과 `''` 이 갈린다 — 원장은 `not null default ''`.
        subtype: (r.subtype as string | null) ?? "",
        role: r.role as AssignmentRole,
        prev_assignee: (r.prev_assignee as string | null) ?? null,
        next_assignee: (r.next_assignee as string | null) ?? null,
        source: r.source as AssignmentChangeSource,
        actor_email: (r.actor_email as string | null) ?? null,
        changed_at: r.changed_at as string,
      })),
    );
    if (data.length < CHUNK) return out;
  }

  throw new Error(
    `[assignments] 이력이 너무 많습니다 — ${universityNames.length}개 대학에서 ${HISTORY_MAX_PAGES * CHUNK}줄을 넘겼습니다. 조회 범위를 좁혀야 합니다.`,
  );
}
