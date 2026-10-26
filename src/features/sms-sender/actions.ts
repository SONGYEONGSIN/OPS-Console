"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { canViewMenu } from "@/features/auth/permission";
import { __resetSmsSenderCache } from "./queries";

/**
 * server action 은 라우트 가드를 물려받지 않는다 — 주소를 아는 누구나 호출할 수 있으므로
 * 페이지와 같은 판정(`canViewMenu`)을 여기서 다시 본다.
 */
export async function refreshSmsSenderCache(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const me = await getCurrentOperator();
  if (!me || !canViewMenu("internal-admin", me)) {
    return {
      ok: false,
      error: "권한 없음 — 내부관리자 메뉴를 볼 수 없습니다.",
    };
  }
  __resetSmsSenderCache();
  revalidatePath("/dashboard/internal-admin");
  return { ok: true };
}
