import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeGapRow, GapKind } from "./gaps-shared";

/** 화면에 보여줄 상한. 주제별로 묶이므로 실제 표시 건수는 이보다 훨씬 적다. */
const LIMIT = 300;

/**
 * 아직 안 채운 빈틈만 가져온다.
 *
 * RLS는 select 전체 허용이라 누가 물었든 보인다 — 채우는 건 팀의 일이기 때문이다.
 */
export async function listOpenGaps(): Promise<KnowledgeGapRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_gaps")
    .select("id, kind, topic, note, near_paths, question, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id as string,
    kind: r.kind as GapKind,
    topic: r.topic as string,
    note: (r.note as string | null) ?? null,
    // null이 화면까지 새면 map()에서 터진다.
    nearPaths: (r.near_paths as string[] | null) ?? [],
    question: r.question as string,
    createdAt: r.created_at as string,
  }));
}
