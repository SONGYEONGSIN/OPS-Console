import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperatorEntry } from "./types";

/**
 * 담당자 이름 → 메일 대조용 명부. 조회 오류를 빈 명부로 돌려주면 전원이
 * '담당자 미확인' 으로 떨어지고 정상 실행처럼 끝난다 — 그래서 던진다.
 */
export async function loadOperatorDirectory(
  db: SupabaseClient,
): Promise<OperatorEntry[]> {
  const { data, error } = await db
    .from("operators")
    .select("name,email,status");
  if (error) throw new Error(`운영자 명부 조회 실패: ${error.message}`);
  return (data ?? []) as OperatorEntry[];
}
