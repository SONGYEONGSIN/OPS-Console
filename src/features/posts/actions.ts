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
} from "./schemas";

export type PostActionResult =
  | { ok: true; row: PostRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — 게시판 작성 권한이 없습니다.";
const PERMISSION_ERROR_NOTICE = "권한 없음 — 공지사항은 admin만 작성할 수 있습니다.";
const PERMISSION_ERROR_AUTHOR = "권한 없음 — 본인이 작성한 글이 아닙니다.";

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

  // 자동 slug 생성 (FB-NNN / NT-NNN) — 동일 domain count + 1, 3자리 zero-pad
  let slug = parsed.data.slug ?? null;
  if (!slug) {
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("domain", parsed.data.domain);
    const prefix = parsed.data.domain === "feedback" ? "FB" : "NT";
    slug = `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...parsed.data, slug })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(pathFor(parsed.data.domain));
  return { ok: true, row: data as PostRow };
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
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(pathFor(target.domain as PostDomain));
  return { ok: true, row: data as PostRow };
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
