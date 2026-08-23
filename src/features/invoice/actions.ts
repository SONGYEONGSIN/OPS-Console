"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditBilling } from "@/features/settlement/completion";
import { ISSUE_TYPES } from "./rows";

export type SetIssuedResult = { ok: true } | { ok: false; error: string };

/**
 * 계산서를 발행했다고 기록하거나(`issueType` 지정), 기록을 지운다(`null`).
 *
 * **폼이 보낸 담당자를 믿지 않는다** — `closing_services` 에서 다시 읽어 판정한다
 * (정산완료와 같은 규칙, `canEditBilling`).
 *
 * 정산완료가 없으면 거부한다. DB 제약도 같은 걸 막지만, 여기서 먼저 막아야
 * 사람이 읽을 수 있는 이유가 화면에 뜬다.
 */
export async function setInvoiceIssued(
  serviceId: number,
  issueType: string | null,
): Promise<SetIssuedResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };

  if (issueType !== null && !ISSUE_TYPES.includes(issueType)) {
    return { ok: false, error: `발행유형은 ${ISSUE_TYPES.join("·")} 만 됩니다` };
  }

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
    return { ok: false, error: "본인이 담당한 서비스만 발행할 수 있습니다" };
  }

  const { data: billing } = await admin
    .from("service_billing")
    .select("settled_at")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!(billing as { settled_at: string | null } | null)?.settled_at) {
    return { ok: false, error: "정산이 끝나지 않은 건입니다" };
  }

  const { error } = await admin
    .from("service_billing")
    .update({
      issued_at: issueType === null ? null : new Date().toISOString(),
      issue_type: issueType,
      issued_by: issueType === null ? null : me.email,
      updated_at: new Date().toISOString(),
    })
    .eq("service_id", serviceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/invoice");
  return { ok: true };
}
