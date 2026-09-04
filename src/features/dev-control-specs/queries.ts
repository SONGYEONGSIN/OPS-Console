import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DevControlSpec, DevControlSpecSend } from "./schemas";

/** 서비스별 명세서 — 서비스당 하나(unique). */
export async function listDevControlSpecs(): Promise<DevControlSpec[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_control_specs")
    .select("id, service_id, items, source_analyzed_at, generated_at");
  if (error) throw new Error(`dev_control_specs 조회 실패: ${error.message}`);
  return (data ?? []) as DevControlSpec[];
}

export async function getDevControlSpec(
  serviceId: number,
): Promise<DevControlSpec | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_control_specs")
    .select("id, service_id, items, source_analyzed_at, generated_at")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error) throw new Error(`dev_control_specs 조회 실패: ${error.message}`);
  return (data as DevControlSpec | null) ?? null;
}

/** 서비스별 최근 발송 이력 — 화면에 '언제 누구에게 보냈는지'를 보여준다. */
export async function listDevControlSpecSends(
  serviceIds: number[],
): Promise<Record<string, DevControlSpecSend>> {
  if (serviceIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_control_spec_sends")
    .select(
      "id, service_id, university_name, to_email, subject, status, error_message, sent_by, sent_at",
    )
    .in("service_id", serviceIds)
    .order("sent_at", { ascending: false });
  if (error)
    throw new Error(`dev_control_spec_sends 조회 실패: ${error.message}`);

  // 서비스당 가장 최근 한 건만 — 목록에는 '마지막으로 언제 나갔나'만 필요하다.
  const latest: Record<string, DevControlSpecSend> = {};
  for (const row of (data ?? []) as DevControlSpecSend[]) {
    const key = String(row.service_id);
    if (!latest[key]) latest[key] = row;
  }
  return latest;
}
