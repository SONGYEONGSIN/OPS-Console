"use server";
// 공개(토큰) 쓰기 — 로그인 없이 통합 작성 링크(fill 토큰)로 해당 회차 항목을 수정한다.
// 모든 경로가 fill-scope 판정(토큰 fill/enabled + 항목이 토큰 회차 범위)을 통과해야 반영.
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { itemPatchSchema, DEPARTMENTS, type Department } from "./schemas";
import {
  assertWriteToken,
  assertItemInRound,
  denyMessage,
  type FillTokenRow,
} from "./fill-scope";

type Result = { ok: true; id?: string } | { ok: false; error: string };
type Admin = ReturnType<typeof createAdminClient>;

/** 토큰 문자열 → fill 토큰 행 조회 + 권한 판정. 실패 시 error 반환. */
async function loadWriteToken(
  sb: Admin,
  token: string,
): Promise<{ ok: true; row: FillTokenRow } | { ok: false; error: string }> {
  const { data } = await sb
    .from("checklist_share_tokens")
    .select("round_id, kind, enabled")
    .eq("token", token)
    .maybeSingle();
  const row = (data as FillTokenRow | null) ?? null;
  const gate = assertWriteToken(row);
  if (!gate.ok) return { ok: false, error: denyMessage(gate.reason) };
  return { ok: true, row: row as FillTokenRow };
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

export async function fillUpdateItem(
  token: string,
  itemId: string,
  patch: unknown,
): Promise<Result> {
  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const sb = createAdminClient();
  const gate = await loadWriteToken(sb, token);
  if (!gate.ok) return gate;

  const { data: item } = await sb
    .from("checklist_items")
    .select("round_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "항목을 찾을 수 없습니다." };
  const scope = assertItemInRound(item, gate.row);
  if (!scope.ok) return { ok: false, error: denyMessage(scope.reason) };

  const { error } = await sb
    .from("checklist_items")
    .update({
      ...toDbPatch(parsed.data),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/r/checklist/${token}`);
  return { ok: true };
}

export async function fillAddItem(
  token: string,
  department: string,
  category: string,
  title: string,
): Promise<Result> {
  if (!(DEPARTMENTS as readonly string[]).includes(department))
    return { ok: false, error: "알 수 없는 부서입니다." };

  const sb = createAdminClient();
  const gate = await loadWriteToken(sb, token);
  if (!gate.ok) return gate;

  const { data, error } = await sb
    .from("checklist_items")
    .insert({
      round_id: gate.row.round_id,
      department: department as Department,
      category: category.slice(0, 200),
      title: title.trim() ? title.slice(0, 500) : "새 항목",
      sort_order: 999,
      updated_by: department,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/r/checklist/${token}`);
  return { ok: true, id: data?.id };
}

export async function fillDeleteItem(
  token: string,
  itemId: string,
): Promise<Result> {
  const sb = createAdminClient();
  const gate = await loadWriteToken(sb, token);
  if (!gate.ok) return gate;

  const { data: item } = await sb
    .from("checklist_items")
    .select("round_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "항목을 찾을 수 없습니다." };
  const scope = assertItemInRound(item, gate.row);
  if (!scope.ok) return { ok: false, error: denyMessage(scope.reason) };

  const { error } = await sb.from("checklist_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/r/checklist/${token}`);
  return { ok: true };
}
