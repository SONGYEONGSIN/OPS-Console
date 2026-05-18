import "server-only";
import { createClient } from "@/lib/supabase/server";
import { servicesRowSchema, type ServicesRow } from "./schemas";

export type ServicesFilter = {
  search?: string;
  ownerEmail?: string;
  ownerMe?: boolean;
  category?: string;
  region?: string;
  universityType?: string;
  applicationType?: string;
  solo?: boolean;
  sort?: "write_end_asc" | "service_id_asc" | "created_desc";
  page?: number;
  pageSize?: number;
};

export type ServicesListResult = {
  rows: ServicesRow[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 30;

/**
 * services 목록 fetch (RSC).
 * RLS: 운영자 전원 read.
 *
 * 정렬 기본: 작성마감 임박순(asc, null 마지막). 옵션으로 service_id / created_at desc.
 * 페이지네이션: page(1-base) × pageSize. count는 supabase head:true로 별도 쿼리 없이 함께 받음.
 */
export async function listServices(
  filter: ServicesFilter = {},
): Promise<ServicesListResult> {
  const supabase = await createClient();
  let query = supabase.from("services").select("*", { count: "exact" });

  if (filter.search) {
    const term = filter.search.trim();
    if (term.length > 0) {
      query = query.or(
        `university_name.ilike.%${term}%,service_name.ilike.%${term}%`,
      );
    }
  }

  if (filter.ownerMe && filter.ownerEmail) {
    query = query.or(
      `operator_email.eq.${filter.ownerEmail},developer_email.eq.${filter.ownerEmail}`,
    );
  } else if (filter.ownerEmail) {
    query = query.eq("operator_email", filter.ownerEmail);
  }

  if (filter.category) query = query.eq("category", filter.category);
  if (filter.region) query = query.eq("region", filter.region);
  if (filter.universityType)
    query = query.eq("university_type", filter.universityType);
  if (filter.applicationType)
    query = query.eq("application_type", filter.applicationType);
  if (typeof filter.solo === "boolean") query = query.eq("solo", filter.solo);

  const sort = filter.sort ?? "write_end_asc";
  if (sort === "write_end_asc") {
    query = query.order("write_end_at", { ascending: true, nullsFirst: false });
  } else if (sort === "service_id_asc") {
    query = query.order("service_id", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = (await query) as {
    data: unknown[] | null;
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[listServices] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const rows: ServicesRow[] = [];
  for (const row of data ?? []) {
    const r = servicesRowSchema.safeParse(row);
    if (r.success) rows.push(r.data);
    else
      console.error(
        "[listServices] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return { rows, total: count ?? 0 };
}

/**
 * 본인 담당 + 접수 시작일 D-{windowDays} 이내 서비스 목록.
 * /dashboard/my-todo 왼쪽 패널의 services 기반 todo 후보.
 * - operator_email = me 또는 developer_email = me 본인 분만
 * - write_start_at IS NOT NULL
 * - write_start_at >= today (이미 시작된 건 제외)
 * - write_start_at <= today + windowDays
 * - 정렬: write_start_at asc (임박순)
 */
export async function listUpcomingForOperator(
  operatorEmail: string,
  windowDays = 60,
): Promise<ServicesRow[]> {
  if (!operatorEmail) return [];

  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const limitStr = limit.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .or(
      `operator_email.eq.${operatorEmail},developer_email.eq.${operatorEmail}`,
    )
    .not("write_start_at", "is", null)
    .gte("write_start_at", todayStr)
    .lte("write_start_at", limitStr)
    .order("write_start_at", { ascending: true });

  if (error) {
    console.error("[listUpcomingForOperator] supabase error:", error);
    return [];
  }

  const parsed: ServicesRow[] = [];
  for (const row of data ?? []) {
    const r = servicesRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listUpcomingForOperator] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

/**
 * 캘린더 month grid 범위에 걸치는 services row를 반환.
 * write_start_at 또는 write_end_at이 [rangeStartYmd, rangeEndYmd] 사이인 row.
 * caller가 그리드 시작/끝 ymd 전달 (YYYY-MM-DD).
 */
export async function listServicesForCalendar(
  rangeStartYmd: string,
  rangeEndYmd: string,
): Promise<ServicesRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .or(
      `and(write_start_at.gte.${rangeStartYmd},write_start_at.lte.${rangeEndYmd}),and(write_end_at.gte.${rangeStartYmd},write_end_at.lte.${rangeEndYmd})`,
    )
    .order("write_start_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[listServicesForCalendar] supabase error:", error);
    return [];
  }

  const parsed: ServicesRow[] = [];
  for (const row of data ?? []) {
    const r = servicesRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listServicesForCalendar] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
