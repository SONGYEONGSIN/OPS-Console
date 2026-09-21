import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GroupMembership } from "./report";

/**
 * 제안 배치·제안 행 읽기.
 *
 * **실패를 빈손으로 돌려주지 않는다.** supabase-js 는 없는 테이블에도 던지지 않고
 * `error` 만 채운다 — 빈 배열로 삼키면 화면이 '제안이 없다' 로 읽히고 사람은 멀쩡한
 * 배치를 찾아 나선다(드리프트 검사가 같은 이유로 가짜 초록이었다).
 *
 * `latestAnnualBasis` 만 예외다. 그건 3월 갱신 상기라는 **부속 정보**여서, 못 읽었다고
 * 학년도 배정 자체를 시작하지 못하면 손해가 더 크다.
 *
 * 배치·제안은 `is_admin()` RLS 라 화면에서는 세션 클라이언트로도 읽히지만, 잡에는
 * 세션이 없다. 그래서 기본은 admin 클라이언트다.
 */

const BATCHES = "assignment_proposal_batches";
const PROPOSALS = "assignment_proposals";

export type ProposalQueryClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from"
>;

export type ProposalBatchRow = {
  id: string;
  academic_year: number;
  kind: "annual" | "single";
  status: "pending" | "applied" | "rejected" | "partial";
  requested_by: string;
  basis: Record<string, unknown>;
  summary: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export type ProposalRow = {
  id: string;
  batch_id: string;
  academic_year: number;
  university_name: string;
  work_kind: string;
  subtype: string;
  role: string;
  prev_assignee: string | null;
  next_assignee: string;
  reason: string;
  decision: "pending" | "applied" | "rejected";
  decided_at: string | null;
};

const BATCH_COLUMNS =
  "id, academic_year, kind, status, requested_by, basis, summary, created_at, decided_at, decided_by";
const PROPOSAL_COLUMNS =
  "id, batch_id, academic_year, university_name, work_kind, subtype, role, prev_assignee, next_assignee, reason, decision, decided_at";

/**
 * 그 학년도에 **검토 대기 중인** annual 배치가 있는가 — rollover 의 `skipped` 판정.
 *
 * **`pending` 만 본다.** 가드의 목적은 "검토를 기다리는 배치가 있는데 또 만들지
 * 않는다" 이지 "그 학년도는 한 번 제안하면 끝" 이 아니다. `rejected`·`applied` 는
 * 결정이 끝난 상태라 새 제안을 막을 이유가 없다.
 *
 * 이 조건은 DB 제약 `assignment_proposal_batches_pending_annual_key`(pending 에만
 * 걸린 partial unique)와 **같다** — 조회가 제약보다 넓으면 제약이 허용하는 일을
 * 코드가 막는다.
 *
 * 2026-09-21 실제 사고: status 를 안 보던 시절, 관리자가 2027 배치를 **반려**하자
 * 그 뒤 모든 실행이 `2027학년도 제안 배치가 이미 있습니다` 로 건너뛰었다. 설계가
 * "반려가 기본 선택지" 라고 정한 선택지를 고르면 그 학년도가 영구히 닫혔다.
 *
 * **실패는 던진다.** 조회 실패를 '없다' 로 읽으면 요청을 다시 적재하고, 폴러가 같은
 * 판정을 돌려 배치가 두 벌 생긴다.
 */
export async function hasPendingAnnualBatch(
  academicYear: number,
  client?: ProposalQueryClient,
): Promise<boolean> {
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from(BATCHES)
    .select("id")
    .eq("academic_year", academicYear)
    .eq("kind", "annual")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`제안 배치 조회 실패: ${error.message}`);
  return data !== null;
}

/**
 * 직전 annual 배치의 그룹 구성 — 3월 갱신 상기의 비교 대상(결정 5).
 *
 * **그 학년도보다 이전만 본다.** `lt` 가 없으면 방금 만든 배치를 자기 자신과 견줘
 * 늘 '같다' 가 되고, 상기가 매년 무조건 떠 아무도 안 보는 경고등이 된다.
 */
export async function latestAnnualBasis(
  academicYear: number,
  client?: ProposalQueryClient,
): Promise<{ previousYear: number | null; previous: GroupMembership | null }> {
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from(BATCHES)
    .select("academic_year, basis")
    .eq("kind", "annual")
    .lt("academic_year", academicYear)
    .order("academic_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { previousYear: null, previous: null };

  const basis = (data.basis ?? {}) as { groups?: unknown };
  const groups =
    basis.groups && typeof basis.groups === "object"
      ? (basis.groups as GroupMembership)
      : null;
  return { previousYear: data.academic_year as number, previous: groups };
}

/** 배치 목록 — 최신순. 제안 탭의 왼쪽이다. */
export async function listProposalBatches(
  client?: ProposalQueryClient,
): Promise<ProposalBatchRow[]> {
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from(BATCHES)
    .select(BATCH_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`제안 배치 조회 실패: ${error.message}`);
  return (data ?? []) as ProposalBatchRow[];
}

/**
 * 배치들의 제안 행. **`batch_id` 로 좁힌다** — 안 좁히면 남의 배치가 섞인다.
 *
 * 화면이 배치 여러 개를 한 번에 그리므로 목록을 받는다 — 배치마다 부르면 화면 한
 * 장에 조회가 열 번 난다.
 */
export async function listProposals(
  batchIds: readonly string[],
  client?: ProposalQueryClient,
): Promise<ProposalRow[]> {
  // 빈 목록으로 `in()` 을 부르지 않는다 — 부를 이유가 없는 조회다.
  if (batchIds.length === 0) return [];
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from(PROPOSALS)
    .select(PROPOSAL_COLUMNS)
    .in("batch_id", [...batchIds])
    .order("university_name", { ascending: true });
  if (error) throw new Error(`제안 조회 실패: ${error.message}`);
  return (data ?? []) as ProposalRow[];
}
