"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGraphToken } from "@/lib/microsoft/auth";
import { assertDeletableProposal } from "./delete-guard";
import { resolvePromotionPath } from "./promote-guard";
import { ensureFolder } from "@/lib/microsoft/drive-upload";

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

export type PromoteResult =
  | { ok: true; toPath: string }
  | { ok: false; error: string };

/**
 * 검토를 마친 초안을 본 위치로 옮긴다.
 *
 * 지금까지는 채팅(`promote_doc`)으로만 됐다. 그런데 **읽고 바로 결정하는 자리는
 * 검토 화면**이라, 옮기는 동작만 다른 화면에 있으면 검토하러 온 사람이 매번 창을
 * 옮겨야 했다. 서버가 이미 Graph 로 볼트에 쓰고 있으므로(삭제가 그렇다) 회사 PC 가
 * 꺼져 있어도 된다 — 채팅 경로는 폴러가 죽으면 함께 막힌다.
 *
 * 막는 층은 삭제와 같은 셋이다: 권한(viewer 거부) · 경로(`제안/` 에서 나가는
 * 방향만) · 인덱스 대조(임의 경로 차단).
 *
 * **분류는 초안이 선언한 것을 쓴다.** 화면에서 고르게 하면 frontmatter 와 폴더가
 * 어긋나 `미분류` 로 떨어진다 — 분류를 바꾸려면 옵시디언에서 frontmatter 를 고친
 * 뒤 옮긴다.
 */
export async function promoteProposalDoc(
  path: string,
): Promise<PromoteResult> {
  const me = await getCurrentOperator();
  if (!me) {
    return { ok: false, error: "로그인이 필요합니다" };
  }
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const vaultId = process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID;
  if (!driveId || !vaultId) {
    return {
      ok: false,
      error: "볼트 위치가 설정되지 않았습니다 (SHAREPOINT_KNOWLEDGE_FOLDER_ID)",
    };
  }

  const admin = createAdminClient();
  // 인덱스에 있는 문서만 옮긴다 — 임의 경로로 Graph를 때리지 않는다.
  const { data: row } = await admin
    .from("knowledge_docs")
    .select("path, graph_item_id, category")
    .eq("path", path)
    .maybeSingle();

  const found = row as {
    graph_item_id?: string | null;
    category?: string | null;
  } | null;
  if (!found?.graph_item_id) {
    return { ok: false, error: "지식망에 없는 문서입니다" };
  }

  let toPath: string;
  try {
    ({ toPath } = resolvePromotionPath(path, found.category ?? ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const category = found.category as string;

  const token = await getGraphToken();
  // 분류 폴더는 이미 있다. 없더라도 만들어 두면 첫 문서가 막히지 않는다.
  const targetId = await ensureFolder(driveId, vaultId, category, { token });

  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${found.graph_item_id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ parentReference: { id: targetId } }),
  });
  if (!res.ok) {
    // 파일은 그대로인데 인덱스만 바뀌면 목록과 볼트가 갈린다 — 여기서 끝낸다.
    return {
      ok: false,
      error:
        res.status === 409
          ? `${category}/ 에 같은 이름 문서가 이미 있습니다. 제목을 바꾼 뒤 다시 옮기세요.`
          : `문서 이동 실패 (${res.status})`,
    };
  }

  // 다음 인덱싱을 기다리지 않는다 — 옮겼는데 목록에 그대로면 두 번 누르게 된다.
  await admin
    .from("knowledge_docs")
    .update({ path: toPath, category })
    .eq("path", path);
  revalidatePath("/dashboard/knowledge");
  return { ok: true, toPath };
}
