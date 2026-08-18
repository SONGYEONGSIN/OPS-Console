"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGraphToken } from "@/lib/microsoft/auth";
import { assertDeletableProposal } from "./delete-guard";

/**
 * 제안 초안 삭제 — 볼트에서 유일하게 화면으로 여는 쓰기 동작.
 *
 * 열람 화면은 설계상 읽기 전용이다. 원본이 파일이라 웹에서 지우면 OneDrive 동기를
 * 타고 사라지고 되돌릴 방법이 화면에 없다. 그래서 사람이 쓴 지식은 계속 옵시디언에서
 * 지우고, **에이전트 초안만** 여기서 치운다 — 다시 만들면 되기 때문이다.
 *
 * 막는 층이 셋이다: 권한(viewer 거부) · 경로(`제안/`만) · 인덱스 대조(임의 경로 차단).
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteProposalDoc(path: string): Promise<DeleteResult> {
  const me = await getCurrentOperator();
  if (!me) {
    return { ok: false, error: "로그인이 필요합니다" };
  }
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  try {
    assertDeletableProposal(path);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) {
    return { ok: false, error: "SHAREPOINT_DRIVE_ID 환경변수가 없습니다" };
  }

  const admin = createAdminClient();
  // 인덱스에 있는 문서만 지운다 — 임의 경로로 Graph를 때리지 않는다.
  const { data: row } = await admin
    .from("knowledge_docs")
    .select("path, graph_item_id")
    .eq("path", path)
    .maybeSingle();

  const itemId = (row as { graph_item_id?: string | null } | null)
    ?.graph_item_id;
  if (!row || !itemId) {
    return { ok: false, error: "지식망에 없는 문서입니다" };
  }

  const token = await getGraphToken();
  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // 파일이 남았는데 목록에서만 사라지면 "지웠는데 계속 있다"가 된다.
    return { ok: false, error: `파일 삭제 실패 (${res.status})` };
  }

  await admin.from("knowledge_docs").delete().eq("path", path);
  revalidatePath("/dashboard/knowledge");
  return { ok: true };
}
