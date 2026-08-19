"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendSpend } from "@/features/petty-cash/actions";

/**
 * 판독 요청과 확정.
 *
 * 판독값은 **확정 전까지 postal_items 에 넣지 않는다** — 사람이 검토한 것만 들어간다.
 * 지식망 `제안/`과 같은 원칙이다(검증 없이 쌓이면 틀린 값이 엑셀로 흘러간다).
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const uuid = z.string().uuid();

/** 화면이 넘기는 검토 행. 담당자는 사람이 고른 최종값이다. */
export type ConfirmRow = {
  daySeq: number;
  trackingNo: string;
  fee: number | null;
  postalCode: string | null;
  recipientOrg: string | null;
  recipientName: string | null;
  assignee: string | null;
};

async function requireWriter(): Promise<
  { ok: true; email: string } | { ok: false; error: string }
> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }
  return { ok: true, email: me.email };
}

/** 영수증 판독을 회사 PC 폴러에 맡긴다. */
export async function requestExtraction(
  receiptId: string,
): Promise<ActionResult> {
  const who = await requireWriter();
  if (!who.ok) return who;
  if (!uuid.safeParse(receiptId).success) {
    return { ok: false, error: "영수증을 찾을 수 없습니다" };
  }

  const admin = createAdminClient();
  // 이미 돌고 있으면 또 넣지 않는다 — 같은 영수증을 두 번 읽을 이유가 없고,
  // 폴러가 한 건씩 처리하므로 줄만 길어진다.
  const { data: live } = await admin
    .from("postal_extract_requests")
    .select("id")
    .eq("receipt_id", receiptId)
    .in("status", ["pending", "running"])
    .limit(1);
  if (live && live.length > 0) {
    return { ok: false, error: "이미 판독 중입니다" };
  }

  const { error } = await admin.from("postal_extract_requests").insert({
    receipt_id: receiptId,
    requested_by: who.email,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/postal");
  return { ok: true };
}

/** 검토를 마친 행을 저장한다. 다시 확정하면 이전 행을 갈아끼운다. */
export async function confirmReceipt(
  receiptId: string,
  rows: ConfirmRow[],
  /** 영수증에서 읽은 접수일자(YYYY-MM-DD). 있으면 전도금 장부에도 한 줄 붙는다. */
  meta: { acceptedAt?: string | null } = {},
): Promise<ActionResult> {
  const who = await requireWriter();
  if (!who.ok) return who;
  if (!uuid.safeParse(receiptId).success) {
    return { ok: false, error: "영수증을 찾을 수 없습니다" };
  }
  if (rows.length === 0) {
    return { ok: false, error: "저장할 등기 건이 없습니다" };
  }
  // 등기번호가 없으면 엑셀에 쓸 수 없다 — 행의 존재 이유다.
  if (rows.some((r) => !r.trackingNo.trim())) {
    return { ok: false, error: "등기번호가 빈 행이 있습니다" };
  }

  const admin = createAdminClient();
  // 고쳐서 다시 낼 수 있어야 한다. 이전 행을 지우고 새로 넣는다.
  await admin.from("postal_items").delete().eq("receipt_id", receiptId);

  const { error } = await admin.from("postal_items").insert(
    rows.map((r) => ({
      receipt_id: receiptId,
      tracking_no: r.trackingNo.trim(),
      fee: r.fee,
      postal_code: r.postalCode,
      recipient_org: r.recipientOrg,
      recipient_name: r.recipientName,
      assignee: r.assignee,
      day_seq: r.daySeq,
    })),
  );
  if (error) return { ok: false, error: error.message };

  await admin
    .from("postal_receipts")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", receiptId);

  // 전도금 장부에도 한 줄 — 손으로 옮겨 적던 일이다.
  //
  // 실패해도 확정은 살린다. postal_items 는 이미 저장됐고, 여기서 실패라고 하면
  // 사람이 다시 확정을 눌러 중복 저장으로 이어진다. 장부는 화면에서 다시 맞출 수 있다.
  const date = meta.acceptedAt?.slice(0, 10);
  const amount = rows.reduce((a, r) => a + (r.fee ?? 0), 0);
  if (date && amount > 0) {
    const spent = await appendSpend({
      date,
      title: "우편물",
      count: rows.length,
      amount,
    });
    if (!spent.ok) {
      console.error("[postal] 전도금 반영 실패:", spent.error);
    }
  }

  revalidatePath("/dashboard/postal");
  return { ok: true };
}
