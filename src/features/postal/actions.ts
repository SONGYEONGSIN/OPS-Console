"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUploadable, receiptStoragePath } from "./upload-guard";

/**
 * 등기발송 영수증 업로드.
 *
 * 영수증에는 수취인 실명과 카드 결제 정보가 찍혀 있다. 버킷을 비공개로 두어 URL만으로
 * 열리지 않게 했고(공개 버킷인 `checklist`와 다르다), 화면은 서버가 그때그때 발급하는
 * 서명 URL로만 연다.
 *
 * **결제 정보는 아예 적지 않는다.** 업무에 쓸 일이 없고, 칸이 없으면 실수로도 안 들어간다.
 */

export const RECEIPT_BUCKET = "postal-receipts";

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

  revalidatePath("/dashboard/postal");
  return { ok: true, id: (data as { id: string }).id };
}
