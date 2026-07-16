import "server-only";
import { createClient } from "@/lib/supabase/server";
import { newsRowSchema, type NewsRow } from "./schemas";

/**
 * 운영부 뉴스 목록 fetch (RSC) — 서버 페이지네이션.
 * RLS: authenticated → 모든 row read 허용 (운영부 공개 정책).
 * 정렬: published_at desc (최신 기사 우선) — null published_at은 후순위.
 * page(1-base)/pageSize로 range 조회, 전체 건수(total) 함께 반환.
 * search가 있으면 title ilike 부분일치로, source/keyword가 있으면 일치로 필터.
 */
export async function listNews(
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    source?: string;
    keyword?: string;
  } = {},
): Promise<{ rows: NewsRow[]; total: number }> {
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const search = opts.search?.trim();
  const source = opts.source?.trim();
  const keyword = opts.keyword?.trim();

  const supabase = await createClient();
  let query = supabase.from("news").select("*", { count: "exact" });
  if (search) query = query.ilike("title", `%${search}%`);
  if (source) query = query.eq("source", source);
  if (keyword) query = query.eq("keyword", keyword);
  const { data, count, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error("[listNews] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const parsed: NewsRow[] = [];
  for (const row of data ?? []) {
    const r = newsRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error("[listNews] zod parse fail:", r.error.issues, "row:", row);
  }
  return { rows: parsed, total: count ?? 0 };
}

/**
 * 출처(source) 필터용 distinct 목록 — 비어있지 않은 출처를 중복 제거해 가나다순 반환.
 * 셀렉트 옵션 소스. 데이터 규모상 source 컬럼만 fetch 후 JS dedupe.
 */
export async function listNewsSources(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("source")
    .not("source", "is", null)
    .limit(2000);

  if (error) {
    console.error("[listNewsSources] supabase error:", error);
    return [];
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const s = (row.source ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 키워드 칩 필터용 distinct 목록 + 키워드별 건수 — 수집 키워드(NEWS_SOURCES 유래)를
 * 실데이터 기준으로. listNewsSources와 동일 패턴 (keyword 컬럼만 fetch 후 JS 집계, 가나다순).
 */
export async function listNewsKeywords(): Promise<
  { keyword: string; count: number }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("keyword")
    .not("keyword", "is", null)
    .limit(2000);

  if (error) {
    console.error("[listNewsKeywords] supabase error:", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const k = (row.keyword ?? "").trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts, ([keyword, count]) => ({ keyword, count })).sort(
    (a, b) => a.keyword.localeCompare(b.keyword, "ko"),
  );
}
