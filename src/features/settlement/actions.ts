"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEADLINE_DAYS } from "./deadline";

export type SetDeadlineResult = { ok: true } | { ok: false; error: string };

/**
 * 대학의 정산기한을 정한다.
 *
 * **대학 단위라 그 대학의 모든 서비스에 한꺼번에 적용된다.** 한 줄에서 고르면
 * 같은 대학의 다른 줄도 함께 바뀐다 — 별도 관리 화면을 두지 않은 이유다.
 * 기한이 빠진 자리가 곧 눈에 띄는 곳이라 거기서 정하는 게 자연스럽다.
 */
export async function setSettlementDeadline(
  universityName: string,
  days: number,
): Promise<SetDeadlineResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  const name = universityName.trim();
  if (!name) return { ok: false, error: "대학명이 비었습니다" };
  // 인수인계 폼과 같은 선택지만 받는다. 두 곳이 갈라지면 어느 쪽이 맞는지 모른다.
  if (!(DEADLINE_DAYS as readonly number[]).includes(days)) {
    return { ok: false, error: `정산기한은 ${DEADLINE_DAYS.join("·")}일만 됩니다` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("settlement_deadlines").upsert(
    {
      university_name: name,
      days,
      updated_by: me.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "university_name" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settlement");
  return { ok: true };
}
