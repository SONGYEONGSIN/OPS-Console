"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSharingToken } from "@/lib/microsoft/sharing-token";
import { FILE_DRAFT_CONTEXT } from "./file-draft-shared";

export type FileDraftResult =
  /** 진행을 지켜보려면 화면이 요청 id 를 알아야 한다 — 답이 여기로 돌아온다. */
  | { ok: true; id: string; question: string }
  | { ok: false; error: string };

/**
 * Teams·SharePoint 파일로 지식망 초안을 만들어 달라고 요청한다.
 *
 * 새 파이프라인을 만들지 않았다. 초안을 만드는 길은 이미 있다 — 어시스턴트 큐에
 * 넣으면 회사 PC 가 `propose_doc` 으로 `제안/` 에 쓰고, 사람이 `promote_doc` 으로
 * 옮긴다(빈틈 초안과 같은 길). 모자랐던 건 **그 파일을 읽을 수단**뿐이라,
 * `read_file` 도구를 붙이고 여기서는 요청만 넣는다.
 *
 * 링크는 큐에 넣기 전에 검사한다 — 30초 뒤에 "사내 링크가 아닙니다"를 듣는 것보다
 * 지금 듣는 편이 낫다.
 */
export async function requestFileDraft(
  url: string,
  note: string,
): Promise<FileDraftResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  const link = url.trim();
  if (!link) return { ok: false, error: "파일 링크를 붙여넣으세요" };
  try {
    toSharingToken(link);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "링크를 읽을 수 없습니다",
    };
  }

  const asked = note.trim();
  const question = [
    "아래 파일을 읽고 지식망에 넣을 초안을 만들어 주세요.",
    "",
    link,
    "",
    // 무엇을 뽑을지는 파일을 올린 사람이 안다 — 모델이 통째로 요약하면 초점이 흐려진다.
    asked ? `요청: ${asked}` : "요청: 이 문서의 요점을 지식망 문서로 정리해 주세요.",
    "",
    "`read_file` 로 파일을 받아 읽고, **파일에 있는 내용만** 쓰세요. 지어내지 마세요.",
    "초안은 `제안/` 에 만들고, 본 위치로 옮기는 것은 사람이 합니다.",
    "표가 많은 파일이면 요약하지 말고 어떤 표가 무엇을 담는지와 원본 링크를 적으세요.",
  ].join("\n");

  return enqueue(me.email, question);
}

/**
 * 붙여넣은 본문으로 초안 만들기.
 *
 * 링크도 파일도 없는 지식이 있다 — 메일 본문, 회의에서 오간 말, 다른 시스템의
 * 화면. `read_file` 을 거치지 않고 본문이 그대로 질문에 들어간다.
 */
export async function requestTextDraft(
  text: string,
  note: string,
): Promise<FileDraftResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  const body = text.trim();
  if (!body) return { ok: false, error: "정리할 내용을 붙여넣으세요" };

  const asked = note.trim();
  const question = [
    "아래 내용을 지식망에 넣을 초안으로 정리해 주세요.",
    "",
    "---",
    body,
    "---",
    "",
    asked
      ? `요청: ${asked}`
      : "요청: 이 내용의 요점을 지식망 문서로 정리해 주세요.",
    "",
    // 파일이 아니라 사람이 붙여넣은 글이라 출처가 문서로 남지 않는다. 그래서
    // 넘겨받은 문장 밖으로 나가지 말라고 더 분명히 말한다.
    "**위 내용에 있는 것만** 쓰세요. 지어내지 마세요. 모자라면 모자란 채로 두고 무엇이 빠졌는지 적으세요.",
    "초안은 `제안/` 에 만들고, 본 위치로 옮기는 것은 사람이 합니다.",
  ].join("\n");

  return enqueue(me.email, question);
}

/**
 * 큐에 넣고 화면이 지켜볼 수 있게 id 를 돌려준다.
 *
 * `page_context` 는 **어느 경로로 왔든 같아야 한다** — 지식망 화면이 이 표식으로
 * 진행 중이던 요청을 찾아 이어받는다.
 */
async function enqueue(
  operatorEmail: string,
  question: string,
): Promise<FileDraftResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .insert({
      operator_email: operatorEmail,
      question,
      page_context: FILE_DRAFT_CONTEXT,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/knowledge");
  // question 도 함께 돌려준다 — 되묻기에 답할 때 history 에 실어야 에이전트가
  // 무슨 이야기였는지 안다. 화면이 프롬프트를 다시 조립하게 두지 않는다.
  return { ok: true, id: data.id, question };
}
