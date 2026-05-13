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
