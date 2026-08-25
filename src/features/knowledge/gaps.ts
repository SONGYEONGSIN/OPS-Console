import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_FOLDER } from "./frontmatter";
import type { KnowledgeGapRow, GapKind } from "./gaps-shared";
import type { PendingProposal } from "./gaps-types";

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
    .select("id, kind, topic, note, near_paths, question, proposal_path, created_at")
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
    proposalPath: (r.proposal_path as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/**
 * 검토 대기 중인 제안 초안.
 *
 * 어느 빈틈에서 나왔는지는 대화(request_id)로만 알 수 있고, 그 기록이 없는
 * 초안도 있다. 제목으로 짐작해 이어붙이면 틀린 연결이 생기므로 **짐작하지 않고**
 * 따로 세운다 — 사람이 같은 문서를 또 쓰는 것만 막으면 목적은 달성된다.
 */
export async function listPendingProposals(): Promise<PendingProposal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_docs")
    .select("path, title")
    // **분류가 아니라 경로로 가른다.** 초안의 category 는 폴더가 아니라 옮겨질
    // 자리라(frontmatter.ts), `category = '제안'` 으로 찾으면 propose_doc 이
    // 분류를 적어 넣은 초안이 통째로 안 잡힌다 — propose_doc 은 늘 적는다.
    .like("path", `${PROPOSAL_FOLDER}/%`)
    .order("path")
    // 검토 대기가 이만큼 쌓였다면 목록이 아니라 운영이 문제다.
    .limit(50);
  if (!data) return [];
  return data.map((r) => ({
    path: r.path as string,
    title: r.title as string,
  }));
}
