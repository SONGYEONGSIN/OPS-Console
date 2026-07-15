import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DevControlAnalysis } from "./schemas";

export async function listDevControlAnalyses(): Promise<DevControlAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_control_analyses")
    .select(
      "id, service_id, file_name, gen_flag, kind, code_hash, raw_code, summary_md, flags, analyzed_at",
    )
    .order("analyzed_at", { ascending: false });
  if (error)
    throw new Error(`dev_control_analyses 조회 실패: ${error.message}`);
  return (data ?? []) as DevControlAnalysis[];
}
