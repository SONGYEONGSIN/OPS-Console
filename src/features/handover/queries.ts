import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  handoverRecordRowSchema,
  type HandoverRecordRow,
  type HandoverStatus,
} from "./schemas";

export type ListInput = {
  q?: string;
  /** 'none' = handover_records 없음 (미작성). 그 외는 status enum */
  status?: HandoverStatus | "none";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

export type HandoverListRow = {
  service_id: string;
  service_number: number;
  university_name: string;
  service_name: string;
  application_type: string;
  operator_name: string | null;
  handover_status: HandoverStatus | null;
};

type RawJoinRow = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  operator_name: string | null;
  handover_records: { status: HandoverStatus }[] | null;
};

/**
 * services left join handover_records. 작성 상태(handover_status) 포함.
 * status='none'은 handover_records가 없는(=한 번도 작성 안 한) row 필터.
 */
export async function listServicesWithHandover(
  input: ListInput = {},
): Promise<{ rows: HandoverListRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("services")
    .select(
      "id, service_id, university_name, service_name, application_type, operator_name, handover_records(status)",
      { count: "exact" },
    )
    .order("service_id", { ascending: true });

  if (input.q) {
    const like = `%${input.q}%`;
    q = q.or(`university_name.ilike.${like},service_name.ilike.${like}`);
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  q = q.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[listServicesWithHandover]", error);
    return { rows: [], total: 0 };
  }

  const rows: HandoverListRow[] = ((data ?? []) as RawJoinRow[]).map((r) => ({
    service_id: r.id,
    service_number: r.service_id,
    university_name: r.university_name,
    service_name: r.service_name,
    application_type: r.application_type,
    operator_name: r.operator_name,
    handover_status: r.handover_records?.[0]?.status ?? null,
  }));

  const filtered = input.status
    ? rows.filter((r) =>
        input.status === "none"
          ? r.handover_status === null
          : r.handover_status === input.status,
      )
    : rows;

  return { rows: filtered, total: count ?? 0 };
}

export type ServiceLite = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  operator_name: string | null;
};

/**
 * services 단건 fetch — handover detail page 헤더용 (대학명·서비스명·운영자 등).
 */
export async function getServiceForHandover(
  serviceId: string,
): Promise<ServiceLite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, service_id, university_name, service_name, application_type, operator_name",
    )
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServiceLite;
}

export async function getHandoverByServiceId(
  serviceId: string,
): Promise<HandoverRecordRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_records")
    .select("*")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error) {
    console.error("[getHandoverByServiceId]", error);
    return null;
  }
  if (!data) return null;
  const r = handoverRecordRowSchema.safeParse(data);
  if (!r.success) {
    console.error("[getHandoverByServiceId] zod fail:", r.error.issues);
    return null;
  }
  return r.data;
}
