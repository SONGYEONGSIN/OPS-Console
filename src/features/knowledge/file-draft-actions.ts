"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSharingToken } from "@/lib/microsoft/sharing-token";

export type FileDraftResult = { ok: true } | { ok: false; error: string };

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

  const admin = createAdminClient();
  const { error } = await admin.from("assistant_requests").insert({
    operator_email: me.email,
    question,
    page_context: "지식망 — 파일로 초안",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/knowledge");
  return { ok: true };
}
