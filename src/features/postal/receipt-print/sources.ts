import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECEIPT_BUCKET } from "../upload-guard";
import { readRegions, type Regions } from "../extract-parse";

/** 영수증 출력의 재료 — 사진 경로, 올린 시각, 최신 판독의 접수일시·위치. */
export type PrintSource = {
  id: string;
  storagePath: string;
  createdAt: string;
  acceptedAt: string | null;
  regions: Regions | null;
};

/**
 * 고른 영수증들의 출력 재료. 없는 id(그사이 지운 것)는 빠진다.
 *
 * 판독은 **영수증당 최신 1건**만 본다 — 목록(`getExtractStates`)과 같은 규칙이다.
 * 화면이 목록의 접수일시로 묶음을 나눴으니 여기서도 같은 값을 봐야 순서가 같다.
 *
 * 조회 오류는 던진다. supabase-js 는 오류를 빈 결과로 돌려줘, 그대로 두면
 * '영수증을 찾을 수 없습니다' 나 형광펜 없는 PDF 로 조용히 둔갑한다.
 */
export async function loadPrintSources(ids: string[]): Promise<PrintSource[]> {
  const admin = createAdminClient();
  const [receipts, requests] = await Promise.all([
    admin
      .from("postal_receipts")
      .select("id, storage_path, created_at")
      .in("id", ids),
    admin
      .from("postal_extract_requests")
      .select("receipt_id, result, requested_at")
      .in("receipt_id", ids)
      .order("requested_at", { ascending: false }),
  ]);
  if (receipts.error) {
    throw new Error(`영수증을 읽지 못했습니다: ${receipts.error.message}`);
  }
  if (requests.error) {
    throw new Error(`판독 결과를 읽지 못했습니다: ${requests.error.message}`);
  }

  const latest = new Map<string, unknown>();
  for (const r of (requests.data ?? []) as {
    receipt_id: string;
    result: unknown;
  }[]) {
    if (!latest.has(r.receipt_id)) latest.set(r.receipt_id, r.result);
  }

  const rows = (receipts.data ?? []) as {
    id: string;
    storage_path: string;
    created_at: string;
  }[];
  return rows.map((r) => {
    const result = latest.get(r.id);
    return {
      id: r.id,
      storagePath: r.storage_path,
      createdAt: r.created_at,
      acceptedAt: acceptedAtOf(result),
      regions: readRegions(result),
    };
  });
}

function acceptedAtOf(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("accepted_at" in result))
    return null;
  return typeof result.accepted_at === "string" ? result.accepted_at : null;
}

/** 저장소에서 사진을 받는다. 실패하면 null — 그 칸에 사유를 적는다. */
export async function downloadReceipt(
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
