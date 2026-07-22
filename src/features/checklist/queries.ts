import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCompletion, type Completion } from "./completion";
import type { ChecklistRound, ChecklistItem, ShareToken } from "./schemas";

function mapRound(r: Record<string, unknown>): ChecklistRound {
  return {
    id: r.id as string,
    title: r.title as string,
    periodStart: (r.period_start as string) ?? null,
    periodEnd: (r.period_end as string) ?? null,
    status: r.status as ChecklistRound["status"],
    createdBy: (r.created_by as string) ?? null,
    createdAt: r.created_at as string,
  };
}
function mapItem(r: Record<string, unknown>): ChecklistItem {
  return {
    id: r.id as string,
    roundId: r.round_id as string,
    department: r.department as ChecklistItem["department"],
    category: (r.category as string) ?? "",
    title: r.title as string,
    status: (r.status as ChecklistItem["status"]) ?? null,
    note: (r.note as string) ?? "",
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

export async function listRounds(): Promise<
  (ChecklistRound & { completion: Completion })[]
> {
  const sb = await createClient();
  const { data: rounds, error } = await sb
    .from("checklist_rounds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listRounds: ${error.message}`);
  const { data: items } = await sb
    .from("checklist_items")
    .select("round_id,status");
  return (rounds ?? []).map((r) => {
    const its = (items ?? [])
      .filter((i) => i.round_id === r.id)
      .map((i) => ({ status: i.status as ChecklistItem["status"] }));
    return { ...mapRound(r), completion: computeCompletion(its) };
  });
}

export async function getRoundWithItems(id: string) {
  const sb = await createClient();
  const { data: round } = await sb
    .from("checklist_rounds")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!round) return null;
  const { data: items } = await sb
    .from("checklist_items")
    .select("*")
    .eq("round_id", id)
    .order("department")
    .order("sort_order");
  return { round: mapRound(round), items: (items ?? []).map(mapItem) };
}

export async function listTokens(roundId: string): Promise<ShareToken[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("checklist_share_tokens")
    .select("*")
    .eq("round_id", roundId)
    .order("kind");
  return (data ?? []).map((t) => ({
    id: t.id,
    roundId: t.round_id,
    kind: t.kind,
    department: t.department ?? null,
    token: t.token,
    enabled: t.enabled,
  }));
}
