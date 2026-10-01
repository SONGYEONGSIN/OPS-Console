import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReceiptTop } from "./extract-parse";
import { downloadReceipt } from "./receipt-print/sources";
import { RECEIPT_BUCKET, receiptStoragePath } from "./upload-guard";

/** 자동 세우기가 건 재판독의 요청자. 이 판독은 다시 세우지 않는다 — 한 번만. */
export const AUTO_ROTATE_REQUESTER = "auto-rotate";

type SidewaysTop = Exclude<ReceiptTop, "top">;

/** 영수증 맨 위가 향한 쪽 → 바로 세우는 각도. sharp `rotate` 는 시계 방향이다. */
const TURN: Record<SidewaysTop, number> = { right: 270, bottom: 180, left: 90 };

export type StraightenOutcome =
  | "upright" // 바로 섰다 — 할 일 없음
  | "already-rotated" // 자동 세우기가 건 재판독 — 또 돌리지 않는다
  | "not-landscape" // 세로 사진에 right·left — 판독이 틀린 것으로 보고 둔다
  | "rotated" // 세워 저장하고 재판독을 걸었다
  | "failed"; // 어디선가 멈췄다 — 첫 판독은 남고 사진은 누운 채(위치는 안 쓰인다)

type Admin = ReturnType<typeof createAdminClient>;

/**
 * 누운 사진을 세운다. 90° 돌림(right·left)은 **가로 사진에서만** — 누운 긴 영수증은 가로
 * 사진에 담긴다. 세로 사진에 right·left 면 판독이 틀린 것으로 보고 null.
 * 메타데이터를 싣지 않는다 — 회전 정보가 남지 않는다(업로드 세우기와 같다).
 */
export async function turnUpright(
  photo: Buffer,
  top: SidewaysTop,
): Promise<Buffer | null> {
  const { width = 0, height = 0 } = await sharp(photo).metadata();
  if (top !== "bottom" && width <= height) return null;
  return sharp(photo).rotate(TURN[top]).jpeg({ quality: 92 }).toBuffer();
}

/**
 * 픽셀째 누운 영수증 사진을 세워 저장하고 한 번 더 판독을 건다(스펙 §5.6).
 *
 * 영수증을 옆으로 놓고 폰을 가로로 들고 찍으면 사진은 바로 서고(회전 정보 없음) 영수증만
 * 눕는다 — 업로드의 `uprightPhoto` 는 회전 정보만 보므로 못 잡는다. 판독이 영수증 맨 위가
 * 어느 쪽인지(`receipt_top`) 알려 주면, 판독 결과를 저장한 **뒤에** 여기서 세운다.
 *
 * **던지지 않는다** — 판독 결과는 이미 저장됐고, 어디서 멈춰도 사진이 누운 채 남을 뿐이다
 * (`readRegions` 가 누운 판독의 위치를 쓰지 않는다).
 */
export async function straightenSideways(
  requestId: string,
  top: ReceiptTop | null,
): Promise<StraightenOutcome> {
  if (top === null || top === "top") return "upright";
  try {
    return await straighten(createAdminClient(), requestId, top);
  } catch (err) {
    return failed(requestId, "처리 중 예외", err);
  }
}

async function straighten(
  admin: Admin,
  requestId: string,
  top: SidewaysTop,
): Promise<StraightenOutcome> {
  const { data, error } = await admin
    .from("postal_extract_requests")
    .select("receipt_id, requested_by, postal_receipts(storage_path)")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return failed(requestId, "요청 읽기", error);
  const req = data as unknown as {
    receipt_id: string;
    requested_by: string;
    postal_receipts: { storage_path: string } | null;
  };
  if (req.requested_by === AUTO_ROTATE_REQUESTER) return "already-rotated";

  const oldPath = req.postal_receipts?.storage_path;
  const photo = oldPath ? await downloadReceipt(oldPath) : null;
  if (!oldPath || !photo) return failed(requestId, "사진 받기", null);

  const upright = await turnUpright(photo, top);
  if (!upright) return "not-landscape";

  const replaced = await replacePhoto(admin, req.receipt_id, oldPath, upright);
  if (replaced !== null) return failed(requestId, "사진 바꾸기", replaced);

  const { error: queueError } = await admin
    .from("postal_extract_requests")
    .insert({
      receipt_id: req.receipt_id,
      requested_by: AUTO_ROTATE_REQUESTER,
    });
  if (queueError) return failed(requestId, "재판독 요청", queueError);
  return "rotated";
}

/**
 * 세운 사진을 **새 경로**에 올리고 영수증의 경로를 바꾼 뒤 옛 사진을 지운다 — 같은 경로에
 * 덮으면 서명 URL·캐시가 옛 사진을 보여 줄 수 있다. 경로를 못 바꾸면(그사이 지움 등) 새
 * 사진을 지우고 옛 것을 둔다. 실패한 까닭을 돌려준다(성공이면 null).
 */
async function replacePhoto(
  admin: Admin,
  receiptId: string,
  oldPath: string,
  photo: Buffer,
): Promise<string | null> {
  const bucket = admin.storage.from(RECEIPT_BUCKET);
  // 경로는 늘 `날짜/이름` 이다(receiptStoragePath) — 같은 날짜 폴더에 새 이름으로.
  const folder = oldPath.slice(0, oldPath.lastIndexOf("/"));
  const newPath = receiptStoragePath(folder, randomUUID(), "receipt.jpg");

  const up = await bucket.upload(newPath, photo, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (up.error) return `올리기: ${up.error.message}`;

  const { data, error } = await admin
    .from("postal_receipts")
    .update({ storage_path: newPath })
    .eq("id", receiptId)
    .eq("storage_path", oldPath)
    .select("id");
  if (error || !data || data.length === 0) {
    await bucket.remove([newPath]);
    return `경로 바꾸기: ${error?.message ?? "영수증이 없거나 사진이 바뀌었다"}`;
  }

  const removed = await bucket.remove([oldPath]);
  // 옛 사진이 남아도 아무도 안 연다 — 로그만 남기고 넘어간다.
  if (removed.error) {
    console.error("[postal] 옛 사진 삭제 실패:", oldPath, removed.error);
  }
  return null;
}

function failed(
  requestId: string,
  step: string,
  err: unknown,
): StraightenOutcome {
  console.error(`[postal] 누운 사진 세우기 실패 — ${step}:`, requestId, err);
  return "failed";
}
