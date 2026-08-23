"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEADLINE_DAYS } from "./deadline";
import { canEditBilling } from "./completion";

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

export type SetSettledResult = { ok: true } | { ok: false; error: string };

/**
 * 이 서비스의 정산을 끝냈다고 표시하거나, 표시를 되돌린다.
 *
 * **폼이 보낸 담당자를 믿지 않는다** — `closing_services` 에서 다시 읽어 판정한다.
 * 목록 화면의 값은 사용자가 바꿔 보낼 수 있고, 그러면 남의 담당 건을 닫을 수 있다
 * (오픈안내에서 같은 이유로 같은 방식을 쓴다).
 *
 * 되돌릴 때 발행 기록이 이미 있으면 막는다. 발행은 정산완료 위에만 얹히므로
 * 아래를 빼면 표의 제약(`service_billing_issue_needs_settle`)과 어긋난다.
 */
export async function setSettlementCompleted(
  serviceId: number,
  done: boolean,
): Promise<SetSettledResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };

  const admin = createAdminClient();

  const { data: service } = await admin
    .from("closing_services")
    .select("operator_name")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!service) return { ok: false, error: "서비스를 찾을 수 없습니다" };

  if (
    !canEditBilling({
      operatorName: (service as { operator_name: string | null }).operator_name,
      myName: me.operator?.name ?? null,
      permission: me.permission,
    })
  ) {
    return { ok: false, error: "본인이 담당한 서비스만 표시할 수 있습니다" };
  }

  if (done) {
    const { error } = await admin.from("service_billing").upsert(
      {
        service_id: serviceId,
        settled_at: new Date().toISOString(),
        settled_by: me.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_id" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: existing } = await admin
      .from("service_billing")
      .select("issued_at")
      .eq("service_id", serviceId)
      .maybeSingle();
    if ((existing as { issued_at: string | null } | null)?.issued_at) {
      return {
        ok: false,
        error: "이미 계산서를 발행한 건입니다. 발행을 먼저 취소하세요",
      };
    }

    const { error } = await admin
      .from("service_billing")
      .update({
        settled_at: null,
        settled_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", serviceId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settlement");
  revalidatePath("/dashboard/invoice");
  return { ok: true };
}
