import "server-only";
import { createClient } from "@/lib/supabase/server";
import { closingServicesRowSchema, type ClosingRow } from "./schemas";

export type ClosingFilter = {
  search?: string;
  region?: string;
  category?: string;
  universityType?: string;
  /** 마감여부 — closed: 작성마감 지남 / open: 마감 전 / all: 전체. 미지정 시 전체. */
  closedStatus?: "closed" | "open" | "all";
  page?: number;
  pageSize?: number;
};

export type ClosingListResult = {
  rows: ClosingRow[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 30;

/**
 * closing_services 목록 fetch (RSC). RLS: 운영자 전원 read.
 * 정렬 기본: 작성마감 최신순(write_end_at desc). 페이지네이션 page(1-base) × pageSize.
 */
export async function listClosing(
  filter: ClosingFilter = {},
): Promise<ClosingListResult> {
  const supabase = await createClient();
  let query = supabase.from("closing_services").select("*", { count: "exact" });

  if (filter.search) {
    const term = filter.search.trim();
    if (term.length > 0) {
      query = query.or(
        `university_name.ilike.%${term}%,service_name.ilike.%${term}%,operator_name.ilike.%${term}%`,
      );
    }
  }

  if (filter.region) query = query.eq("region", filter.region);
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.universityType)
    query = query.eq("university_type", filter.universityType);

  // 마감여부 — 작성마감(write_end_at) 기준 현재 시각 비교
  if (filter.closedStatus === "closed")
    query = query.lt("write_end_at", new Date().toISOString());
  else if (filter.closedStatus === "open")
    query = query.gte("write_end_at", new Date().toISOString());

  query = query.order("write_end_at", { ascending: false });

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
    console.error("[listClosing] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const rows: ClosingRow[] = [];
  for (const row of data ?? []) {
    const r = closingServicesRowSchema.safeParse(row);
    if (r.success) rows.push(r.data);
    else
      console.error(
        "[listClosing] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return { rows, total: count ?? 0 };
}
