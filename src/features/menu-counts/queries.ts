import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listContracts } from "@/features/contracts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";

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
    countOf("worklog", supabase.from("worklog").select("*", head)),
  ]);

  const map = new Map<string, number>();
  for (const [slug, count] of results) {
    if (count !== null) map.set(slug, count);
  }
  return map;
}

/**
 * 본인 기준 카운트 — mine=true 토글 시 사용.
 * me 소유 구분 가능한 도메인만: services / handover / incidents / backup /
 * schedule / my-todo / worklog.
 * contracts / receivables / contacts 등 sheet/외부 source 또는 me 컬럼 부재
 * 도메인은 제외 (호출자가 tile 자체를 hide).
 */
export async function getMineCounts(
  currentUserEmail: string | null,
): Promise<Map<string, number>> {
  if (!currentUserEmail) return new Map();
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const results = await Promise.all([
    countOf(
      "my-todo",
      supabase
        .from("todos")
        .select("*", head)
        .eq("assignee_email", currentUserEmail),
    ),
    countOf(
      "services",
      supabase
        .from("services")
        .select("*", head)
        .eq("operator_email", currentUserEmail),
    ),
    countOf(
      "handover",
      supabase
        .from("handover_records")
        .select("*", head)
        .neq("status", "draft")
        .eq("author_email", currentUserEmail),
    ),
    countOf(
      "incidents",
      supabase
        .from("incidents")
        .select("*", head)
        .or(
          `reporter_email.eq.${currentUserEmail},assignee_email.eq.${currentUserEmail}`,
        ),
    ),
    countOf(
      "backup",
      supabase
        .from("backup_requests")
        .select("*", head)
        .or(
          `requester_email.eq.${currentUserEmail},substitute_email.eq.${currentUserEmail}`,
        ),
    ),
    countOf(
      "schedule",
      supabase
        .from("schedule_events")
        .select("*", head)
        .or(
          `assignee_email.eq.${currentUserEmail},created_by_email.eq.${currentUserEmail}`,
        ),
    ),
    countOf(
      "worklog",
      supabase
        .from("worklog")
        .select("*", head)
        .eq("user_email", currentUserEmail),
    ),
  ]);

  const map = new Map<string, number>();
  for (const [slug, count] of results) {
    if (count !== null) map.set(slug, count);
  }
  return map;
}
