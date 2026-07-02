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

/** 테스트 대상 서비스 목록 — closing_services(서비스 마감 실데이터) 라이트 컬럼 전체. */
export async function listTestableServices(): Promise<TestableService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select(
      "service_id, university_name, service_name, category, region, university_type, admission_type, operator_name, write_start_at, write_end_at, pay_start_at, pay_end_at",
    )
    .order("write_end_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data as TestableService[];
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
