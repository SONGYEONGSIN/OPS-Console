import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECEIPT_BUCKET } from "./upload-guard";
import { buildReviewRows, type ReviewRow, type ExtractedItem } from "./review-rows";
import { loadAssigneeRows } from "./assignee-queries";

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

/** 판독 상태 — 카드에 무엇을 보여줄지 가른다. */
export type ExtractState = {
  status: "none" | "pending" | "running" | "done" | "failed";
  warnings: string[];
  message: string | null;
  /** 영수증 접수일자 — 전도금 장부에 적을 날짜다. */
  acceptedAt: string | null;
  /** done일 때만. 검토 표의 재료. */
  rows: ReviewRow[];
};

/**
 * 영수증별 판독 상태 + 검토 행.
 *
 * 담당자 조회를 위해 총괄장 두 시트를 읽는다 — 한 번 읽어 모든 영수증에 쓴다
 * (영수증마다 읽으면 Graph 호출이 그만큼 늘어난다).
 */
export async function getExtractStates(
  receiptIds: string[],
): Promise<Map<string, ExtractState>> {
  const out = new Map<string, ExtractState>();
  if (receiptIds.length === 0) return out;

  const admin = createAdminClient();
  const { data: reqs } = await admin
    .from("postal_extract_requests")
    .select("receipt_id, status, result, warnings, message, requested_at")
    .in("receipt_id", receiptIds)
    .order("requested_at", { ascending: false });

  // 영수증당 최신 1건만 본다 — 다시 판독하면 앞의 것은 의미가 없다.
  const latest = new Map<string, Record<string, unknown>>();
  for (const r of reqs ?? []) {
    const key = r.receipt_id as string;
    if (!latest.has(key)) latest.set(key, r);
  }
  if (latest.size === 0) return out;

  // 판독이 끝난 게 하나라도 있을 때만 총괄장을 읽는다.
  const needsAssignee = [...latest.values()].some((r) => r.status === "done");
  const { under, grad } = needsAssignee
    ? await loadAssigneeRows()
    : { under: [], grad: [] };

  for (const [receiptId, r] of latest) {
    const status = r.status as ExtractState["status"];
    const result = r.result as
      | { items?: ExtractedItem[]; accepted_at?: string | null }
      | null;
    out.set(receiptId, {
      status,
      warnings: (r.warnings as string[] | null) ?? [],
      message: (r.message as string | null) ?? null,
      acceptedAt: result?.accepted_at ?? null,
      rows:
        status === "done" && result?.items
          ? buildReviewRows(result.items, { under, grad, alreadyOnThatDay: 0 })
          : [],
    });
  }
  return out;
}
