"use server";

/**
 * 주간업무보고 작성 action — 메모·빼기·직접 추가·프로젝트·그림·탭 확인.
 * 모든 action 은 `authorizeReportEdit` 로 세션·보고서·주를 DB 에서 다시 읽고 판정한다.
 * 쓰기 대상 id 는 폼이 아니라 판정이 돌려준 보고서 행(`ctx.report.id`)에서 나온다.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_IMAGE_BYTES,
  OPS_WEEKLY_BUCKET,
  OPS_WEEKLY_IMAGE_RE,
  OPS_WEEKLY_PATH,
  OPS_WEEKLY_SIGNED_URL_TTL_SEC,
} from "./constants";
import { normEmail } from "./email";
import { authorizeReportEdit, type EditContext } from "./guard";
import { opsWeeklyImagePrefix, toStoredNoteHtml } from "./note-images";
import { activeOwnedProjectIds } from "./report-queries";
import {
  areaNoteInputSchema,
  imageUploadInputSchema,
  itemOverrideInputSchema,
  manualItemInputSchema,
  manualItemRefInputSchema,
  projectEntryInputSchema,
  storedProjectHtmlSchema,
} from "./schemas";
import { rowOf } from "./week-queries";

export type ActionResult = { ok: true } | { ok: false; error: string };
type Fail = { ok: false; error: string };
type DbError = { message: string } | null;

const OK: ActionResult = { ok: true };

const failOf = (error: string): Fail => ({ ok: false, error });

function writeFailed(label: string, err: DbError): Fail | null {
  return err ? failOf(`${label} 저장에 실패했습니다: ${err.message}`) : null;
}

/** 입력 검사 → 판정. 둘 중 하나라도 실패하면 Fail 을 돌려준다. */
async function parseAndAuthorize<S extends z.ZodType<{ reportId: string }>>(
  schema: S,
  input: unknown,
): Promise<{ data: z.infer<S>; ctx: EditContext } | Fail> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const auth = await authorizeReportEdit(parsed.data.reportId);
  if (!auth.ok) return failOf(auth.error);
  return { data: parsed.data, ctx: auth.ctx };
}

const isFail = <T extends object>(v: T | Fail): v is Fail =>
  "ok" in v && v.ok === false;

function done(): ActionResult {
  revalidatePath(OPS_WEEKLY_PATH);
  return OK;
}

export async function saveAreaNote(input: unknown): Promise<ActionResult> {
  const g = await parseAndAuthorize(areaNoteInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  const { error } = await createAdminClient()
    .from("ops_weekly_area_notes")
    .upsert(
      {
        report_id: ctx.report.id,
        area: data.area,
        this_week: data.thisWeek,
        next_week: data.nextWeek,
        updated_by: ctx.actor.email,
      },
      { onConflict: "report_id,area" },
    );
  return writeFailed("메모", error) ?? done();
}

export async function saveItemOverride(input: unknown): Promise<ActionResult> {
  const g = await parseAndAuthorize(itemOverrideInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  // 보낸 칸만 쓴다 — 빼기만 바꿀 때 메모를 지우지 않는다.
  const row = {
    report_id: ctx.report.id,
    item_key: data.itemKey,
    area: data.area,
    ...(data.note !== undefined ? { note: data.note } : {}),
    ...(data.excluded !== undefined ? { excluded: data.excluded } : {}),
    updated_by: ctx.actor.email,
  };
  const { error } = await createAdminClient()
    .from("ops_weekly_item_overrides")
    .upsert(row, { onConflict: "report_id,item_key" });
  return writeFailed("항목", error) ?? done();
}

export async function addManualItem(
  input: unknown,
): Promise<ActionResult & { id?: string }> {
  const g = await parseAndAuthorize(manualItemInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  const res = await createAdminClient()
    .from("ops_weekly_manual_items")
    .insert({
      report_id: ctx.report.id,
      area: data.area,
      group_key: data.groupKey,
      title: data.title,
      note: data.note ?? "",
      period_start: data.periodStart ?? null,
      period_end: data.periodEnd ?? null,
      leave_kind: data.leaveKind ?? null,
      created_by: ctx.actor.email,
    })
    .select("id")
    .single();
  const failed = writeFailed("항목", res.error);
  if (failed) return failed;
  const id = (res.data as { id: string } | null)?.id;
  revalidatePath(OPS_WEEKLY_PATH);
  return { ok: true, id };
}

export async function removeManualItem(input: {
  reportId: string;
  itemId: string;
}): Promise<ActionResult> {
  const g = await parseAndAuthorize(manualItemRefInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  // 그 보고서의 항목일 때만 지운다 — 남의 보고서 항목 id 를 섞어 보내도 0행이다.
  const res = await createAdminClient()
    .from("ops_weekly_manual_items")
    .delete()
    .eq("id", data.itemId)
    .eq("report_id", ctx.report.id)
    .select("id");
  const failed = writeFailed("항목", res.error);
  if (failed) return failed;
  if (((res.data as unknown[] | null) ?? []).length === 0) {
    return failOf("항목을 찾을 수 없습니다.");
  }
  return done();
}

async function ownsProject(ctx: EditContext, projectId: string) {
  const res = await createAdminClient()
    .from("ops_weekly_project_owners")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("operator_email", normEmail(ctx.report.operator_email))
    .maybeSingle();
  return (
    rowOf<{ project_id: string }>("ops_weekly_project_owners", res) !== null
  );
}

/** 금주·차주 HTML 을 저장용으로 정화하고 길이를 본다(base64 그림은 정화에서 이미 빠진다). */
function storedHtmlPair(
  ctx: EditContext,
  thisWeek: string,
  nextWeek: string,
): { thisWeek: string; nextWeek: string } | Fail {
  const prefix = opsWeeklyImagePrefix(ctx.week.week_start, ctx.report.id);
  const pair = {
    thisWeek: toStoredNoteHtml(thisWeek, prefix),
    nextWeek: toStoredNoteHtml(nextWeek, prefix),
  };
  for (const html of [pair.thisWeek, pair.nextWeek]) {
    const checked = storedProjectHtmlSchema.safeParse(html);
    if (!checked.success) return failOf(checked.error.issues[0].message);
  }
  return pair;
}

export async function saveProjectEntry(input: unknown): Promise<ActionResult> {
  const g = await parseAndAuthorize(projectEntryInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  if (!(await ownsProject(ctx, data.projectId))) {
    return failOf("담당 항목이 아닙니다.");
  }
  const html = storedHtmlPair(ctx, data.thisWeek, data.nextWeek);
  if (isFail(html)) return html;
  const res = await createAdminClient()
    .from("ops_weekly_project_entries")
    .update({
      stage: data.stage,
      this_week: html.thisWeek,
      next_week: html.nextWeek,
      updated_by: ctx.actor.email,
    })
    .eq("report_id", ctx.report.id)
    .eq("project_id", data.projectId)
    .select("id");
  const failed = writeFailed("프로젝트", res.error);
  if (failed) return failed;
  if (((res.data as unknown[] | null) ?? []).length === 0) {
    return failOf("프로젝트 항목을 찾을 수 없습니다. 화면을 새로 고치세요.");
  }
  return done();
}

type DecodedImage = { mime: string; ext: string; buf: Buffer };

/** fill-actions(checklist) 와 같은 규칙·문구. */
function decodeImage(dataUrl: string): DecodedImage | Fail {
  const m = OPS_WEEKLY_IMAGE_RE.exec(dataUrl);
  if (!m) return failOf("이미지 형식이 아닙니다.");
  const ext = m[2] === "jpeg" || m[2] === "jpg" ? "jpg" : m[2];
  const buf = Buffer.from(m[3], "base64");
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) {
    return failOf("이미지 크기가 유효하지 않습니다(5MB 이하).");
  }
  return { mime: m[1], ext, buf };
}

/**
 * 그림 업로드 — 비공개 버킷이라 1시간 **서명 URL** 을 돌려준다. 이 URL 은 편집기 안에서만 살고,
 * 저장할 때 `toStoredNoteHtml` 이 경로로 되돌린다. DB 를 바꾸지 않으므로 revalidate 하지 않는다.
 */
export async function uploadWeeklyImage(input: {
  reportId: string;
  dataUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const g = await parseAndAuthorize(imageUploadInputSchema, input);
  if (isFail(g)) return g;
  const { data, ctx } = g;
  const owned = await activeOwnedProjectIds(ctx.report.operator_email);
  if (owned.length === 0) {
    return failOf("그림은 프로젝트·TF에만 붙일 수 있습니다.");
  }
  const image = decodeImage(data.dataUrl);
  if (isFail(image)) return image;
  const path = `${opsWeeklyImagePrefix(ctx.week.week_start, ctx.report.id)}${randomUUID()}.${image.ext}`;
  const bucket = createAdminClient().storage.from(OPS_WEEKLY_BUCKET);
  const up = await bucket.upload(path, image.buf, {
    contentType: image.mime,
    upsert: false,
  });
  if (up.error) return failOf(`그림을 올리지 못했습니다: ${up.error.message}`);
  const signed = await bucket.createSignedUrl(
    path,
    OPS_WEEKLY_SIGNED_URL_TTL_SEC,
  );
  if (signed.error || !signed.data?.signedUrl) {
    return failOf(
      `그림 주소를 만들지 못했습니다: ${signed.error?.message ?? "응답 없음"}`,
    );
  }
  return { ok: true, url: signed.data.signedUrl };
}

