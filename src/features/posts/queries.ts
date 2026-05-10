import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  postRowSchema,
  type PostDomain,
  type PostRow,
} from "./schemas";

/**
 * 게시판 도메인별 글 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (도메인 무관).
 * 정렬: created_at desc (최신글 위).
 */
export async function listPosts(domain: PostDomain): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("domain", domain)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPosts] supabase error:", error);
    return [];
  }

  const parsed: PostRow[] = [];
  for (const row of data ?? []) {
    const r = postRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listPosts] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

export async function getPostById(id: string): Promise<PostRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const r = postRowSchema.safeParse(data);
  return r.success ? r.data : null;
}
