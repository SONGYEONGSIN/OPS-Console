import "server-only";
import { createClient } from "@/lib/supabase/server";
import { closingServicesRowSchema, type ClosingRow } from "./schemas";
import { monthRange } from "./derive";

export type ClosingFilter = {
  search?: string;
  region?: string;
  category?: string;
  universityType?: string;
  /** 마감여부 — closed: 작성마감 지남 / open: 마감 전 / all: 전체. 미지정 시 전체. */
  closedStatus?: "closed" | "open" | "all";
  /** '내 마감' 칩 — operator_name 일치(현재 운영자 이름)로 본인 담당만. */
  operatorName?: string;
  /** 월별 필터 "YYYY-MM" — 해당 월에 오픈(write_start_at) 또는 마감(write_end_at)한 건. */
  month?: string;
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
  if (filter.operatorName)
    query = query.eq("operator_name", filter.operatorName);

  // 마감여부 — 결제마감(pay_end_at) 기준 현재 시각 비교
  if (filter.closedStatus === "closed")
    query = query.lt("pay_end_at", new Date().toISOString());
  else if (filter.closedStatus === "open")
    query = query.gte("pay_end_at", new Date().toISOString());

  // 월별 — 해당 월에 오픈(write_start_at) 또는 마감(write_end_at)한 건.
  const range = filter.month ? monthRange(filter.month) : null;
  if (range) {
    query = query.or(
      `and(write_start_at.gte.${range.start},write_start_at.lt.${range.end}),` +
        `and(write_end_at.gte.${range.start},write_end_at.lt.${range.end})`,
    );
  }

  query = query.order("pay_end_at", { ascending: false });

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

/** 카테고리 셀렉트 옵션 — closing_services의 distinct category(빈값 제외) 가나다순. */
export async function listClosingCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select("category");
  if (error) {
    console.error("[listClosingCategories] supabase error:", error);
    return [];
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const c = (row as { category?: string | null }).category?.trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

/** 대학구분 셀렉트 옵션 — closing_services의 distinct university_type(빈값 제외) 가나다순. */
export async function listClosingUniversityTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select("university_type");
  if (error) {
    console.error("[listClosingUniversityTypes] supabase error:", error);
    return [];
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const t = (
      row as { university_type?: string | null }
    ).university_type?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 월별 셀렉트 옵션 — closing_services의 오픈(write_start_at)·마감(write_end_at) 날짜에서
 * distinct "YYYY-MM" 수집(빈값 제외). 최신 월 먼저(내림차순).
 */
export async function listClosingMonths(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select("write_start_at, write_end_at");
  if (error) {
    console.error("[listClosingMonths] supabase error:", error);
    return [];
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const r = row as {
      write_start_at?: string | null;
      write_end_at?: string | null;
    };
    for (const iso of [r.write_start_at, r.write_end_at]) {
      if (iso && iso.length >= 7) set.add(iso.slice(0, 7)); // "YYYY-MM"
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
