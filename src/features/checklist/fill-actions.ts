"use server";
// 공개(토큰) 쓰기 — 로그인 없이 통합 작성 링크(fill 토큰)로 해당 회차 항목을 수정한다.
// 모든 경로가 fill-scope 판정(토큰 fill/enabled + 항목이 토큰 회차 범위)을 통과해야 반영.
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { itemPatchSchema, DEPARTMENTS, type Department } from "./schemas";
import { sanitizeNoteHtml } from "./note-html";
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
  if (p.note !== undefined) out.note = sanitizeNoteHtml(p.note);
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

const IMAGE_RE =
  /^data:(image\/(png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 작성폼 이미지 붙여넣기 — dataURL 업로드 후 항목 attachments에 공개 URL 추가. */
export async function fillUploadImage(
  token: string,
  itemId: string,
  dataUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const m = IMAGE_RE.exec(dataUrl);
  if (!m) return { ok: false, error: "이미지 형식이 아닙니다." };
  const mime = m[1];
  const ext = m[2] === "jpeg" || m[2] === "jpg" ? "jpg" : m[2];
  const buf = Buffer.from(m[3], "base64");
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES)
    return { ok: false, error: "이미지 크기가 유효하지 않습니다(5MB 이하)." };

  const sb = createAdminClient();
  const gate = await loadWriteToken(sb, token);
  if (!gate.ok) return gate;

  const { data: item } = await sb
    .from("checklist_items")
    .select("round_id, attachments")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "항목을 찾을 수 없습니다." };
  const scope = assertItemInRound(item, gate.row);
  if (!scope.ok) return { ok: false, error: denyMessage(scope.reason) };

  const path = `${gate.row.round_id}/${itemId}/${randomUUID()}.${ext}`;
  const up = await sb.storage
    .from("checklist")
    .upload(path, buf, { contentType: mime, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };
  const url = sb.storage.from("checklist").getPublicUrl(path).data.publicUrl;

  // 인라인 삽입 방식: 업로드 후 URL만 반환한다(에디터가 note HTML에 <img>로 삽입 후 저장).
  // attachments 배열에는 더 이상 추가하지 않는다(중복 표시 방지). 기존 attachments는 레거시 표시 유지.
  revalidatePath(`/r/checklist/${token}`);
  return { ok: true, url };
}

/** 첨부 이미지 제거 — attachments에서 URL 삭제 + Storage 파일 제거(best-effort). */
export async function fillRemoveAttachment(
  token: string,
  itemId: string,
  url: string,
): Promise<Result> {
  const sb = createAdminClient();
  const gate = await loadWriteToken(sb, token);
  if (!gate.ok) return gate;

  const { data: item } = await sb
    .from("checklist_items")
    .select("round_id, attachments")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "항목을 찾을 수 없습니다." };
  const scope = assertItemInRound(item, gate.row);
  if (!scope.ok) return { ok: false, error: denyMessage(scope.reason) };

  const next = ((item.attachments as string[]) ?? []).filter((u) => u !== url);
  const { error } = await sb
    .from("checklist_items")
    .update({ attachments: next })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  const marker = "/object/public/checklist/";
  const idx = url.indexOf(marker);
  if (idx >= 0)
    await sb.storage.from("checklist").remove([url.slice(idx + marker.length)]);
  revalidatePath(`/r/checklist/${token}`);
  return { ok: true };
}
