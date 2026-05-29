"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import {
  postCreateSchema,
  postUpdateSchema,
  type PostDomain,
  type PostRow,
  type PostStatus,
} from "./schemas";
import { sendFeedbackOwnerNotify, sendFeedbackStatusNotify } from "./mailer";

export type PostActionResult =
  | { ok: true; row: PostRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — 게시판 작성 권한이 없습니다.";
const PERMISSION_ERROR_NOTICE =
  "권한 없음 — 공지사항은 admin만 작성할 수 있습니다.";
const PERMISSION_ERROR_AUTHOR = "권한 없음 — 본인이 작성한 글이 아닙니다.";
const SLUG_RETRY_LIMIT = 5;
const SLUG_EXHAUSTED_ERROR =
  "slug 자동 부여 실패 — 잠시 후 다시 시도해 주세요.";
const UNIQUE_VIOLATION_CODE = "23505";

function slugPrefix(domain: PostDomain): string {
  return domain === "feedback" ? "FB" : "NT";
}

async function getMaxSlugNum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  domain: PostDomain,
): Promise<number> {
  const prefix = slugPrefix(domain);
  const { data: maxRow } = await supabase
    .from("posts")
    .select("slug")
    .eq("domain", domain)
    .like("slug", `${prefix}-%`)
    .order("slug", { ascending: false })
    .limit(1)
    .maybeSingle();
  const match = (maxRow?.slug as string | undefined)?.match(/-(\d+)$/);
  return match ? parseInt(match[1] ?? "0", 10) : 0;
}

function canCreate(domain: PostDomain, me: CurrentOperator | null): boolean {
  if (!me || me.permission === "viewer" || me.permission === null) return false;
  if (domain === "notice") return me.permission === "admin";
  return true; // feedback: admin or member
}

function canEdit(
  postDomain: PostDomain,
  postAuthorEmail: string,
  me: CurrentOperator | null,
): boolean {
  if (!me) return false;
  if (me.permission === "admin") return true;
  if (postDomain === "notice") return false; // admin only
  // feedback: 본인 글만
  return me.email === postAuthorEmail;
}

function pathFor(domain: PostDomain): string {
  return domain === "notice" ? "/dashboard/notices" : "/dashboard/feedback";
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000"
  );
}

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true";
}

export async function createPost(input: unknown): Promise<PostActionResult> {
  const parsed = postCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!canCreate(parsed.data.domain, me)) {
    return {
      ok: false,
      error:
        parsed.data.domain === "notice"
          ? PERMISSION_ERROR_NOTICE
          : PERMISSION_ERROR_VIEWER,
    };
  }

  const supabase = await createClient();

  // 자동 slug 생성 (FB-NNN / NT-NNN) — 현재 최대 번호 + 1.
  // 23505 (unique violation) 시 다음 번호로 재시도 — 동시성/시드/삭제 후 재등록으로
  // 발생하는 충돌 회복. 명시적 slug가 제공되면 재시도하지 않고 즉시 실패.
  const explicitSlug = parsed.data.slug ?? null;
  const prefix = slugPrefix(parsed.data.domain);
  let nextNum = explicitSlug
    ? 0
    : (await getMaxSlugNum(supabase, parsed.data.domain)) + 1;

  let row: PostRow | null = null;
  for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt++) {
    const slug =
      explicitSlug ?? `${prefix}-${String(nextNum).padStart(3, "0")}`;
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...parsed.data, slug })
      .select()
      .single();

    if (!error) {
      row = data as PostRow;
      break;
    }
    if (error.code !== UNIQUE_VIOLATION_CODE || explicitSlug) {
      return { ok: false, error: error.message };
    }
    nextNum++;
  }

  if (!row) {
    return { ok: false, error: SLUG_EXHAUSTED_ERROR };
  }

  revalidatePath(pathFor(parsed.data.domain));

  if (row.domain === "feedback" && me) {
    try {
      await sendFeedbackOwnerNotify({
        post: row,
        senderEmail: me.email,
        senderOperatorId: null,
        authorName: me.displayName,
        appUrl: baseUrl(),
        dryRun: isDryRun(),
      });
    } catch (e) {
      console.error("feedback owner notify failed:", e);
    }
  }

  return { ok: true, row };
}

export async function updatePost(
  id: string,
  input: unknown,
): Promise<PostActionResult> {
  const parsed = postUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  const supabase = await createClient();

  // 권한 분기 — target 글 lookup
  const { data: target } = await supabase
    .from("posts")
    .select("domain, author_email, status")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: "글을 찾을 수 없습니다." };

  if (!canEdit(target.domain as PostDomain, target.author_email, me)) {
    return {
      ok: false,
      error:
        target.domain === "notice"
          ? PERMISSION_ERROR_NOTICE
          : PERMISSION_ERROR_AUTHOR,
    };
  }

  const { data, error } = await supabase
    .from("posts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as PostRow;
  revalidatePath(pathFor(target.domain as PostDomain));

  const prevStatus = target.status as PostStatus;
  const nextStatus = parsed.data.status as PostStatus | undefined;
  if (
    row.domain === "feedback" &&
    me &&
    nextStatus !== undefined &&
    nextStatus !== prevStatus
  ) {
    try {
      await sendFeedbackStatusNotify({
        post: row,
        statusTo: nextStatus,
        senderEmail: me.email,
        senderOperatorId: null,
        changerName: me.displayName,
        appUrl: baseUrl(),
        dryRun: isDryRun(),
      });
    } catch (e) {
      console.error("feedback status notify failed:", e);
    }
  }

  return { ok: true, row };
}

export async function deletePost(id: string): Promise<PostActionResult> {
  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("posts")
    .select("domain, author_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: "글을 찾을 수 없습니다." };

  if (!canEdit(target.domain as PostDomain, target.author_email, me)) {
    return {
      ok: false,
      error:
        target.domain === "notice"
          ? PERMISSION_ERROR_NOTICE
          : PERMISSION_ERROR_AUTHOR,
    };
  }

  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  revalidatePath(pathFor(target.domain as PostDomain));
  return { ok: true, row: data as PostRow };
}
