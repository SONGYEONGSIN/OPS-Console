import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  invoiceAmountIngestSchema,
  selectAmountUpdates,
} from "@/features/invoice/amount-ingest";

/**
 * Moa 정산 금액 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 회사 PC 폴러가 Moa 내부관리자 정산 화면에서 읽은 `(서비스ID, 금액)` 을 보낸다.
 * Moa 스크랩은 회사 PC 에서만 된다 — Cloudflare 가 데이터센터 IP 를 막고 로그인에
 * SMS 본인확인이 붙는다 (`scripts/moa-closing/scrape.py` 와 같은 제약).
 *
 * **정산완료된 건에만 쓴다.** 금액이 먼저 들어와 행이 생기면 `settled_at` 없는
 * 행이 만들어지고, 그건 계산서발행 목록("정산 끝난 것만")의 전제를 깬다.
 * 건너뛴 서비스는 응답에 담아 돌려준다 — 조용히 버리면 왜 금액이 비어 있는지
 * 알 길이 없다.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 },
    );
  }

  const parsed = invoiceAmountIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { scraped_at, rows } = parsed.data;
  const supabase = createAdminClient();

  const { data: settled, error: readError } = await supabase
    .from("service_billing")
    .select("service_id")
    .not("settled_at", "is", null);
  if (readError) {
    return NextResponse.json(
      { ok: false, error: readError.message },
      { status: 500 },
    );
  }

  const { updates, skipped } = selectAmountUpdates(
    rows,
    ((settled ?? []) as { service_id: number }[]).map((r) => r.service_id),
  );

  for (const u of updates) {
    const { error } = await supabase
      .from("service_billing")
      .update({
        settled_amount: u.amount,
        amount_synced_at: scraped_at,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", u.service_id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    received: rows.length,
    updated: updates.length,
    // 정산완료가 안 된 서비스. 스크래퍼가 보냈지만 아직 쓸 자리가 없는 것들이다.
    skipped,
  });
}
