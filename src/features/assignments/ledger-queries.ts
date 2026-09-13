import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LedgerRowDraft } from "./import";
import type { AssignmentRole, AssignmentWorkKind } from "./ledger-schemas";

/**
 * 원장 한 행 = 시트 쪽 초안 + **이메일**.
 *
 * 이력의 단위가 이메일이라(마이그레이션 주석) 이력 비교에 이 칸이 필요하다 —
 * 이름만 비교하면 운영자 메일이 바뀐 경우를 '안 바뀜' 으로 읽는다. `LedgerRowDraft`
 * 를 넓힌 모양이라 `reconcile` 에는 그대로 넘어간다.
 */
export type LedgerRow = LedgerRowDraft & { assignee_email: string | null };

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
