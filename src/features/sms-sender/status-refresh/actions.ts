"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { canViewMenu } from "@/features/auth/permission";
import { enqueueStatusRefresh } from "./enqueue";
import { canRequestStatusRefresh } from "./permission";

/**
 * 현황 최신화 요청. server action 은 라우트 가드를 물려받지 않고 폼도 믿지 않는다 —
 * 로그인한 운영자를 서버에서 다시 읽어 메뉴 권한과 버튼 권한(admin·담당자)을 본다.
 */
export async function requestStatusRefresh(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const me = await getCurrentOperator();
  if (!me || !canViewMenu("internal-admin", me)) {
    return {
      ok: false,
      error: "권한 없음 — 내부관리자 메뉴를 볼 수 없습니다.",
    };
  }
  if (
    !canRequestStatusRefresh(me, process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL)
  ) {
    return {
      ok: false,
      error:
        "현황 최신화는 관리자와 SMS 발신번호 등록 담당자만 할 수 있습니다.",
    };
  }

  const result = await enqueueStatusRefresh(me.email);
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath("/dashboard/internal-admin");
  return { ok: true, message: result.message };
}
