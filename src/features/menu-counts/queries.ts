import "server-only";
import { createClient } from "@/lib/supabase/server";

type CountResult = { count: number | null; error: { message: string } | null };

async function countOf(
  slug: string,
  q: PromiseLike<CountResult>,
): Promise<readonly [string, number | null]> {
  const { count, error } = await q;
  if (error) {
    console.error(`[menu-counts] ${slug} fail:`, error.message);
    return [slug, null];
  }
  return [slug, count ?? 0];
}

/**
 * 사이드바 메뉴별 실 row count. dashboard/layout.tsx에서 1회 fetch 후
 * sidebar sections에 적용. Promise.all 병렬 + count(head=true).
 * receivables(Excel) / mock 도메인은 미포함 — sidebar hardcode 유지.
 */
export async function getMenuCounts(
  currentUserEmail: string | null,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const results = await Promise.all([
    countOf(
      "my-todo",
      supabase
        .from("todos")
        .select("*", head)
        .eq("assignee_email", currentUserEmail ?? ""),
    ),
    countOf("my-ai-work", supabase.from("ai_work").select("*", head)),
    countOf("ai-insight", supabase.from("insight_videos").select("*", head)),
    countOf(
      "team",
      supabase.from("operators").select("*", head).eq("status", "active"),
    ),
    countOf("schedule", supabase.from("schedule_events").select("*", head)),
    countOf(
      "notices",
      supabase.from("posts").select("*", head).eq("domain", "notice"),
    ),
    countOf(
      "feedback",
      supabase.from("posts").select("*", head).eq("domain", "feedback"),
    ),
    countOf(
      "onboarding",
      supabase.from("onboarding_cohorts").select("*", head),
    ),
    countOf("services", supabase.from("services").select("*", head)),
    countOf("contacts", supabase.from("contacts").select("*", head)),
    countOf("backup", supabase.from("backup_requests").select("*", head)),
  ]);

  const map = new Map<string, number>();
  for (const [slug, count] of results) {
    if (count !== null) map.set(slug, count);
  }
  return map;
}
