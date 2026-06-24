import "server-only";
import { createClient } from "@/lib/supabase/server";
import { quoteRowSchema, type QuoteRow, type QuoteStatus } from "./schemas";

/**
 * 견적서 목록 fetch (RSC) — 서버 페이지네이션.
 * RLS: authenticated → 모든 row read 허용.
 * 정렬: quote_date desc.
 * status eq 필터, customer ilike 검색, range 페이지네이션.
 */
export async function listQuotes(
  input: {
    page?: number;
    pageSize?: number;
    status?: QuoteStatus;
    search?: string;
  } = {},
): Promise<{ rows: QuoteRow[]; total: number }> {
  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = input.search?.trim();

  const supabase = await createClient();
  let q = supabase.from("quotes").select("*", { count: "exact" });
  if (input.status) q = q.eq("status", input.status);
  if (search) q = q.ilike("customer", `%${search}%`);
  const { data, count, error } = await q
    .order("quote_date", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listQuotes] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const rows: QuoteRow[] = [];
  for (const row of data ?? []) {
    const p = quoteRowSchema.safeParse(row);
    if (p.success) rows.push(p.data);
    else console.error("[listQuotes] zod parse fail:", p.error.issues);
  }
  return { rows, total: count ?? 0 };
}
