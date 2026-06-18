import "server-only";
import { createClient } from "@/lib/supabase/server";
import { entertestRunSchema, type EntertestRun } from "./schemas";

/** 최근 실행 이력 (기본 50건, 최신순). 파싱 실패 행은 제외. */
export async function listEntertestRuns(limit = 50): Promise<EntertestRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entertest_test_runs")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .map((row) => entertestRunSchema.safeParse(row))
    .filter((r): r is { success: true; data: EntertestRun } => r.success)
    .map((r) => r.data);
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
