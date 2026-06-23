import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listContracts } from "@/features/contracts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { getMyDataRequestServices } from "@/features/data-requests/queries";

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

/** SharePoint Excel 도메인 count — fetch 실패 시 null로 fallback (사이드바 빈 칸) */
async function countContracts(): Promise<readonly [string, number | null]> {
  try {
    const { total } = await listContracts();
    return ["contracts", total];
  } catch (e) {
    console.error("[menu-counts] contracts fail:", e);
    return ["contracts", null];
  }
}
/** 자료 요청 — 본인 담당 services 수(listServices ownerMe 필터). fetch 실패 시 null */
async function countDataRequests(
  meEmail: string | null,
): Promise<readonly [string, number | null]> {
  try {
    const { total } = await getMyDataRequestServices(meEmail ?? "", 1, 1);
    return ["data-requests", total];
  } catch (e) {
    console.error("[menu-counts] data-requests fail:", e);
    return ["data-requests", null];
  }
}
async function countReceivables(): Promise<readonly [string, number | null]> {
  try {
    const sheet = await fetchReceivablesSheet();
    return ["receivables", sheet?.rows.length ?? null];
  } catch (e) {
    console.error("[menu-counts] receivables fail:", e);
    return ["receivables", null];
  }
}

/**
 * 사이드바 메뉴별 실 row count. dashboard/layout.tsx에서 1회 fetch 후
 * sidebar sections에 적용. Promise.all 병렬 + count(head=true).
 * SharePoint Excel(contracts/receivables)도 포함 — Graph API fetch 실패 시 null fallback (빈 칸).
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
    countOf("ai-tips", supabase.from("ai_tips").select("*", head)),
    countOf("ai-insight", supabase.from("insight_videos").select("*", head)),
    countOf(
      "team",
      supabase.from("operators").select("*", head).eq("status", "active"),
    ),
    countOf("schedule", supabase.from("schedule_events").select("*", head)),
    countOf("news", supabase.from("news").select("*", head)),
    countOf("meetings", supabase.from("meetings").select("*", head)),
    countOf(
      "mailbox",
      supabase
        .from("mailbox_messages")
        .select("*", head)
        .eq("owner_email", currentUserEmail ?? ""),
    ),
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
    countOf("closing", supabase.from("closing_services").select("*", head)),
    countOf("contacts", supabase.from("contacts").select("*", head)),
    countOf("backup", supabase.from("backup_requests").select("*", head)),
    countOf("incidents", supabase.from("incidents").select("*", head)),
    countOf(
      "handover",
      supabase
        .from("handover_records")
        .select("*", head)
        .neq("status", "draft"),
    ),
    countContracts(),
    countReceivables(),
    countDataRequests(currentUserEmail),
    countOf("worklog", supabase.from("worklog").select("*", head)),
  ]);

  const map = new Map<string, number>();
  for (const [slug, count] of results) {
    if (count !== null) map.set(slug, count);
  }
  return map;
}
