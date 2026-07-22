"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/auth/permission";
import { createRoundSchema, itemPatchSchema, type Department } from "./schemas";
import { CHECKLIST_TEMPLATE } from "./template";
import { buildSeedItems } from "./seed";

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createRoundAction(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = createRoundSchema.safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
    seed: formData.get("seed"),
    cloneFromRoundId: formData.get("cloneFromRoundId") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { data: round, error } = await sb
    .from("checklist_rounds")
    .insert({
      title: parsed.data.title,
      period_start: parsed.data.periodStart ?? null,
      period_end: parsed.data.periodEnd ?? null,
      created_by: me.email,
    })
    .select("id")
    .single();
  if (error || !round)
    return { ok: false, error: error?.message ?? "생성 실패" };

  let cloned: {
    department: Department;
    category: string;
    title: string;
    sortOrder: number;
  }[] = [];
  if (parsed.data.seed === "clone" && parsed.data.cloneFromRoundId) {
    const { data } = await sb
      .from("checklist_items")
      .select("department,category,title,sort_order")
      .eq("round_id", parsed.data.cloneFromRoundId);
    cloned = (data ?? []).map((i) => ({
      department: i.department as Department,
      category: i.category,
      title: i.title,
      sortOrder: i.sort_order,
    }));
  }
  const rows = buildSeedItems(parsed.data.seed, CHECKLIST_TEMPLATE, cloned).map(
    (r) => ({
      round_id: round.id,
      department: r.department,
      category: r.category,
      title: r.title,
      status: r.status,
      note: r.note,
      sort_order: r.sortOrder,
    }),
  );
  if (rows.length) {
    const { error: seedError } = await sb.from("checklist_items").insert(rows);
    if (seedError) return { ok: false, error: seedError.message };
  }
  revalidatePath("/dashboard/checklist");
  return { ok: true, id: round.id };
}

export async function updateItemAction(itemId: string, patch: unknown) {
  await requireAdmin();
  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { error } = await sb
    .from("checklist_items")
    .update({ ...toDbPatch(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", itemId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

function toDbPatch(p: {
  status?: string | null;
  note?: string;
  title?: string;
  category?: string;
}) {
  const out: Record<string, unknown> = {};
  if ("status" in p) out.status = p.status ?? null;
  if (p.note !== undefined) out.note = p.note;
  if (p.title !== undefined) out.title = p.title;
  if (p.category !== undefined) out.category = p.category;
  return out;
}

export async function addItemAction(
  roundId: string,
  department: Department,
  category: string,
) {
  await requireAdmin();
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("checklist_items")
    .insert({
      round_id: roundId,
      department,
      category,
      title: "새 항목",
      sort_order: 999,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true, id: data?.id };
}

export async function deleteItemAction(itemId: string, roundId: string) {
  await requireAdmin();
  const sb = createAdminClient();
  const { error } = await sb.from("checklist_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true };
}

/**
 * 공유 링크 토글(생성/해제) — reports `toggleReportShare` 패턴. 회차·kind당 1개.
 * fill = 전 부서 통합 작성 링크, report = 임원 보고(읽기) 링크. 있으면 삭제, 없으면 발급.
 */
export async function toggleChecklistShare(
  roundId: string,
  kind: "fill" | "report",
) {
  await requireAdmin();
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("checklist_share_tokens")
    .select("id")
    .eq("round_id", roundId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) {
    await sb.from("checklist_share_tokens").delete().eq("id", existing.id);
    revalidatePath(`/dashboard/checklist/${roundId}`);
    return { ok: true, token: null };
  }
  const { data, error } = await sb
    .from("checklist_share_tokens")
    .insert({ round_id: roundId, kind, department: null, token: newToken() })
    .select("token")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true, token: data?.token };
}
