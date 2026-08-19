"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertUploadable,
  receiptStoragePath,
  RECEIPT_BUCKET,
} from "./upload-guard";
import { requestExtraction } from "./extract-actions";
import { canDeleteReceipt } from "./delete-guard";

/**
 * 등기발송 영수증 업로드.
 *
 * 영수증에는 수취인 실명과 카드 결제 정보가 찍혀 있다. 버킷을 비공개로 두어 URL만으로
 * 열리지 않게 했고(공개 버킷인 `checklist`와 다르다), 화면은 서버가 그때그때 발급하는
 * 서명 URL로만 연다.
 *
 * **결제 정보는 아예 적지 않는다.** 업무에 쓸 일이 없고, 칸이 없으면 실수로도 안 들어간다.
 */

export type UploadResult =
  { ok: true; id: string } | { ok: false; error: string };

export async function uploadReceipt(file: File): Promise<UploadResult> {
  const me = await getCurrentOperator();
  if (!me) {
    return { ok: false, error: "로그인이 필요합니다" };
  }
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }

  try {
    assertUploadable(file.name, file.type, file.size);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const id = randomUUID();
  const dateFolder = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());

  let path: string;
  try {
    path = receiptStoragePath(dateFolder, id, file.name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (up.error) {
    // 파일이 없는데 카드만 남으면 열어도 아무것도 안 나온다.
    return { ok: false, error: `저장 실패: ${up.error.message}` };
  }

  const { data, error } = await admin
    .from("postal_receipts")
    .insert({
      storage_path: path,
      // 올린 사람 = 엑셀의 '확인' 칸.
      uploaded_by: me.displayName,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 행을 못 만들었으면 파일도 남기지 않는다 — 아무도 못 여는 파일이 쌓인다.
    await admin.storage.from(RECEIPT_BUCKET).remove([path]);
    return { ok: false, error: error?.message ?? "기록 실패" };
  }

  const receiptId = (data as { id: string }).id;

  // 올리자마자 판독을 건다. [추출]을 따로 누르게 하면 목록이 '판독 전'으로만 차고,
  // 사람이 버튼을 누르러 다시 들어와야 한다.
  //
  // 실패해도 업로드는 성공이다 — 파일은 이미 저장됐고, 화면의 [추출]로 다시 걸 수 있다.
  const queued = await requestExtraction(receiptId);
  if (!queued.ok) {
    console.error("[postal] 자동 판독 요청 실패:", queued.error);
  }

  revalidatePath("/dashboard/postal");
  return { ok: true, id: receiptId };
}

/**
 * 잘못 올린 영수증을 지운다.
 *
 * `postal_items`·`postal_extract_requests` 는 FK cascade 로 함께 사라지지만
 * **스토리지 파일은 따로 지워야 한다** — 안 지우면 아무도 못 여는 사진이 비공개
 * 버킷에 쌓인다.
 *
 * 확정건은 막는다(`delete-guard.ts`). 판정을 여기 두지 않은 이유는 upload-guard 와
 * 같다 — 액션 안에 묻으면 경우를 테스트할 수 없다.
 */
export async function deleteReceipt(receiptId: string): Promise<UploadResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };

  const admin = createAdminClient();
  const { data: receipt } = await admin
    .from("postal_receipts")
    .select("id, storage_path, uploaded_by, confirmed_at")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return { ok: false, error: "영수증을 찾을 수 없습니다" };

  const verdict = canDeleteReceipt(
    { permission: me.permission, displayName: me.displayName },
    { uploadedBy: receipt.uploaded_by, confirmedAt: receipt.confirmed_at },
  );
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // 행을 먼저 지운다. 파일만 지우고 행이 남으면 목록에 열리지 않는 카드가 남는데,
  // 그건 지금 고치려는 것보다 나쁘다(지울 수도, 열 수도 없다).
  const { error } = await admin
    .from("postal_receipts")
    .delete()
    .eq("id", receiptId);
  if (error) return { ok: false, error: error.message };

  const rm = await admin.storage
    .from(RECEIPT_BUCKET)
    .remove([receipt.storage_path]);
  if (rm.error) {
    // 행은 이미 사라져 화면에서는 지워졌다. 실패라고 하면 사람이 다시 누르는데
    // 그때는 행이 없어 "찾을 수 없습니다"만 나온다 — 파일만 로그로 남긴다.
    console.error("[postal] 파일 삭제 실패:", receipt.storage_path, rm.error);
  }

  revalidatePath("/dashboard/postal");
  return { ok: true, id: receiptId };
}
