import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceNoticeService } from "./schemas";

type Range = { startISO: string; endISO: string; monthKey: string };

type RawServiceRow = {
  id: string;
  university_name: string;
  service_name: string;
  university_type: string | null;
  category: string | null;
  operator_email: string | null;
  operator_name: string | null;
  write_start_at: string | null;
  write_end_at: string | null;
  pay_start_at: string | null;
  pay_end_at: string | null;
};

/**
 * 다음 달(write_start_at ∈ [start, end)) 작성시작 + operator_email 있는 서비스 조회.
 * cron 컨텍스트(세션 없음)라 admin client(service_role) 사용.
 */
export async function fetchNextMonthServices(
  range: Range,
): Promise<ServiceNoticeService[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("services")
    .select(
      "id, university_name, service_name, university_type, category, operator_email, operator_name, write_start_at, write_end_at, pay_start_at, pay_end_at",
    )
    .gte("write_start_at", range.startISO)
    .lt("write_start_at", range.endISO)
    .not("operator_email", "is", null)
    .order("write_start_at", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("[fetchNextMonthServices]", error);
    return [];
  }

  return ((data ?? []) as RawServiceRow[])
    .filter((r) => r.operator_email && r.write_start_at)
    .map((r) => ({
      id: r.id,
      universityName: r.university_name,
      serviceName: r.service_name,
      universityType: r.university_type ?? "",
      category: r.category ?? "",
      operatorEmail: r.operator_email as string,
      operatorName: r.operator_name,
      writeStartAt: r.write_start_at as string,
      writeEndAt: r.write_end_at,
      payStartAt: r.pay_start_at,
      payEndAt: r.pay_end_at,
    }));
}
