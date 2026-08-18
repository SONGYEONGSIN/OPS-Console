"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 지식망 빈틈 닫기.
 *
 * status 컬럼은 처음부터 있었지만 `open`이 아닌 값으로 바꾸는 경로가 없어
 * **목록이 쌓이기만 했다.** 이미 채운 주제가 '많이 물어본 순' 맨 위를 계속
 * 차지하면 "무엇을 먼저 쓸까"라는 이 화면의 목적이 무너진다.
 *
 * 자동 판정은 하지 않는다 — 문서를 실제로 썼는지 아는 건 사람이고,
 * 기계가 틀리면 아직 없는 지식을 조용히 "해결됨"으로 지운다.
 */

export type CloseGapResult = { ok: true } | { ok: false; error: string };

const CLOSABLE = ["resolved", "dismissed"] as const;
export type ClosedStatus = (typeof CLOSABLE)[number];

export async function closeGapTopic(
  topic: string,
  status: ClosedStatus,
): Promise<CloseGapResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  // 남의 우선순위를 지우는 일이라 읽기 전용에게는 안 연다.
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }
  if (!CLOSABLE.includes(status)) {
    return { ok: false, error: "닫을 수 없는 상태입니다" };
  }
  const t = topic.trim();
  if (!t) return { ok: false, error: "주제가 비어 있습니다" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("knowledge_gaps")
    // 화면이 주제로 묶여 보이므로 주제 단위로 닫는다 — 한 건만 닫으면 나머지가 남아
    // 같은 주제가 목록에 계속 떠 있게 된다.
    .update({
      status,
      resolved_by: me.email,
      resolved_at: new Date().toISOString(),
    })
    .eq("topic", t)
    .eq("status", "open");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/knowledge");
  return { ok: true };
}

/**
 * 이 빈틈으로 초안을 만들어 달라고 어시스턴트에게 요청한다.
 *
 * 채팅을 열어 다시 타이핑하는 대신 큐에 바로 넣는다. 게이트는 그대로다 —
 * 에이전트는 `제안/`에만 쓰고, 사람이 검토해서 옮긴다(설계 §7).
 *
 * 결과는 이 화면으로 돌아온다: 초안이 만들어지면 같은 대화의 빈틈에
 * `proposal_path`가 적혀 '초안 대기 중'으로 뜬다.
 */
export async function requestGapDraft(
  topic: string,
  questions: string[],
): Promise<CloseGapResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }
  const t = topic.trim();
  if (!t) return { ok: false, error: "주제가 비어 있습니다" };

  // 운영자가 실제로 물었던 원문을 같이 보낸다 — 무엇을 써야 하는지는
  // 주제 한 줄보다 원문이 알려준다.
  const asked = questions
    .slice(0, 5)
    .map((q) => `- ${q}`)
    .join("\n");

  const question = [
    `「${t}」를 업무 지식망에 넣을 문서 초안으로 만들어 주세요.`,
    "",
    "운영자들이 실제로 물었던 질문:",
    asked,
    "",
    "근거가 있는 것만 쓰고, 없는 내용은 지어내지 마세요.",
    "근거를 못 찾으면 초안을 만들지 말고 무엇이 없어 못 썼는지 알려주세요.",
  ].join("\n");

  const admin = createAdminClient();
  const { error } = await admin.from("assistant_requests").insert({
    operator_email: me.email,
    question,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/knowledge");
  return { ok: true };
}
