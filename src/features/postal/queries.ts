import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECEIPT_BUCKET } from "./upload-guard";

/**
 * 영수증 목록 — 카드 격자에 그릴 것.
 *
 * 이미지에는 **공개 URL이 없다.** 버킷이 비공개라 서버가 그때그때 서명 URL을 발급해야
 * 열린다. 기존 `checklist` 버킷처럼 공개로 두면 URL만 알아도 수취인 실명과 카드
 * 결제 정보가 찍힌 영수증이 열린다.
 */

/**
 * 서명 URL 만료.
 *
 * 화면을 열어 두고 잠깐 자리를 비우는 정도는 버텨야 하지만, 그 링크가 어딘가에
 * 복사돼도 오래 살아 있으면 안 된다. 목록을 새로 그리면 새 URL이 나온다.
 */
export const SIGNED_URL_TTL_SECONDS = 300;

export type ReceiptCard = {
  id: string;
  uploadedBy: string;
  createdAt: string;
  confirmedAt: string | null;
  /** 서명 URL. 발급에 실패하면 null — 카드는 남기고 이미지만 비운다. */
  imageUrl: string | null;
};

type Row = {
  id: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  confirmed_at: string | null;
};

export async function listReceipts(limit = 60): Promise<ReceiptCard[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("postal_receipts")
    .select("id, storage_path, uploaded_by, created_at, confirmed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Row[];
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      confirmedAt: r.confirmed_at,
      imageUrl: await signedUrl(admin, r.storage_path),
    })),
  );
}

/** 서명이 실패해도 카드는 남긴다 — 통째로 사라지면 무엇이 안 보이는지 알 수 없다. */
async function signedUrl(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
): Promise<string | null> {
  const { data } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
