import { phaseOf } from "@/features/closing/phase";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { entertestRunSchema, type EntertestRun } from "./schemas";

/** 최근 실행 이력 (기본 200건, 최신순). 파싱 실패 행은 제외. */
export async function listEntertestRuns(limit = 200): Promise<EntertestRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entertest_test_runs")
    .select(
      "id, requested_by, requested_at, target_url, service_id, status, claimed_at, finished_at, result, error_message",
    )
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .map((row) => entertestRunSchema.safeParse(row))
    .filter((r): r is { success: true; data: EntertestRun } => r.success)
    .map((r) => r.data);
}

export type TestableService = {
  service_id: number;
  university_name: string;
  service_name: string;
  category: string | null;
  region: string | null;
  university_type: string | null;
  admission_type: string | null;
  operator_name: string | null;
  write_start_at: string | null;
  write_end_at: string | null;
  pay_start_at: string | null;
  pay_end_at: string | null;
};

/**
 * 테스트 대상 서비스 목록 — **아직 접수 시작 전인 것만**.
 *
 * 테스트는 열기 전에 하는 일이다. 접수 중인 건 배포·운영, 끝난 건 서비스마감이
 * 맡는다(`closing/phase.ts`). 전건을 보여주면 지금 손댈 것이 무엇인지 묻힌다.
 */
export async function listTestableServices(): Promise<TestableService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select(
      "service_id, university_name, service_name, category, region, university_type, admission_type, operator_name, write_start_at, write_end_at, pay_start_at, pay_end_at",
    )
    .order("write_end_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  // 쿼리로 거르지 않고 여기서 거른다 — phaseOf 와 같은 규칙을 쓰려는 것이다.
  // 규칙이 두 벌이 되면 화면과 사이드바 숫자가 갈린다.
  return (data as TestableService[]).filter((r) => phaseOf(r) === "upcoming");
}

/**
 * 테스트 URL 호스트를 정하는 접수구분 조회 (buildEntertestTargetUrl 입력).
 * 서비스를 찾지 못하면 null — closing_services는 매일 스크래핑으로 덮어써서
 * 목록을 그린 뒤 사라질 수 있다. 화면이 보낸 값을 믿지 않고 DB에서 다시 읽는다.
 */
export async function findServiceAdmissionType(
  serviceId: number,
): Promise<{ admissionType: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select("admission_type")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    admissionType: (data as { admission_type: string | null }).admission_type,
  };
}

/** 로그인 운영자의 entertest 테스트 계정 ID. 미등록이면 null. */
export async function getMyEntertestAccount(
  email: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("entertest_account")
    .eq("email", email)
    .maybeSingle();
  if (error || !data) return null;
  const account = (data as { entertest_account: string | null })
    .entertest_account;
  return account && account.trim().length > 0 ? account : null;
}
