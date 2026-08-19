import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildExtractPrompt } from "@/features/postal/extract-prompt";
import { parseExtraction } from "@/features/postal/extract-parse";

/**
 * 영수증 판독 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}`.
 *   GET  → pending 1건을 claim. **서명 URL + 프롬프트**를 함께 준다.
 *   POST → 판독 원문을 보고 → 서버가 검증·검산해 저장.
 *
 * 어시스턴트의 claim 창구와 같은 구조다. **판단은 여기 있고 폴러는 실행만 한다** —
 * 프롬프트도 검산도 서버가 하므로 규칙을 고칠 때 회사 PC를 만지지 않는다.
 */

const BUCKET = "postal-receipts";
/** 판독에 넉넉하고, 새 나가도 곧 죽는 길이. */
const SIGNED_URL_TTL_SEC = 300;

function guard(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("postal_extract_requests")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  const { data: claimed, error } = await admin
    .from("postal_extract_requests")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, receipt_id, postal_receipts(storage_path)")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!claimed) return NextResponse.json({ ok: true, request: null });

  const row = claimed as unknown as {
    id: string;
    receipt_id: string;
    postal_receipts: { storage_path: string } | null;
  };
  const path = row.postal_receipts?.storage_path;
  if (!path) {
    return NextResponse.json({ ok: true, request: null });
  }

  // 버킷이 비공개라 폴러도 서명 URL로만 받는다. 짧게 끊어 새어도 곧 죽는다.
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);

  return NextResponse.json({
    ok: true,
    request: {
      id: row.id,
      receiptId: row.receipt_id,
      imageUrl: signed?.signedUrl ?? null,
      fileName: "receipt.jpg",
      prompt: buildExtractPrompt("receipt.jpg"),
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    raw?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  const admin = createAdminClient();
  const finishedAt = new Date().toISOString();

  // 폴러가 실행 자체에 실패한 경우
  if (body.ok !== true) {
    await admin
      .from("postal_extract_requests")
      .update({
        status: "failed",
        message:
          typeof body.message === "string" ? body.message.slice(0, 500) : "판독 실패",
        finished_at: finishedAt,
      })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // 판독 원문을 **서버가** 검증한다 — 모델이 보낸 것을 그대로 믿지 않는다.
  const parsed = parseExtraction(typeof body.raw === "string" ? body.raw : "");
  if (!parsed.ok) {
    await admin
      .from("postal_extract_requests")
      .update({ status: "failed", message: parsed.error, finished_at: finishedAt })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  await admin
    .from("postal_extract_requests")
    .update({
      status: "done",
      result: parsed.data,
      warnings: parsed.warnings,
      finished_at: finishedAt,
    })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
