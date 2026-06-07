import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { closingIngestSchema } from "@/features/closing/schemas";

/**
 * 서비스 마감 스크래퍼 인제스트 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * GitHub Actions cron(스크래퍼)이 격주 "현재 마감된 전체 스냅샷"을 보낸다.
 * 멱등 전략: 전체 대체(delete-all + insert) — 지난 배치에서 사라진 stale row 제거.
 * 빈 배열은 zod에서 거부(전체 삭제 사고 방지). 부분 전송은 스크래퍼가 하지 않는다.
 *
 * service_role(RLS bypass) admin client로만 쓰기. secret 누설 시 임의 주입 가능하나
 * 데이터는 read-only 표시라 영향은 위변조 한정.
 */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = closingIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { scraped_at, rows } = parsed.data;
  const supabase = createAdminClient();

  // 전체 대체 — 같은 scraped_at 부여로 배치 일관성.
  const insertRows = rows.map((r) => ({
    service_id: r.service_id,
    university_name: r.university_name,
    region: r.region ?? null,
    service_name: r.service_name,
    university_type: r.university_type ?? null,
    category: r.category ?? null,
    operator_name: r.operator_name ?? null,
    developer_name: r.developer_name ?? null,
    write_start_at: r.write_start_at ?? null,
    write_end_at: r.write_end_at,
    solo: r.solo,
    scraped_at,
  }));

  // PostgREST delete는 필터를 요구 → 항상 참인 neq(NIL_UUID)로 전체 삭제.
  const { error: deleteError } = await supabase
    .from("closing_services")
    .delete()
    .neq("id", NIL_UUID);
  if (deleteError) {
    return NextResponse.json(
      { ok: false, error: deleteError.message },
      { status: 500 },
    );
  }

  const { error: insertError } = await supabase
    .from("closing_services")
    .insert(insertRows);
  if (insertError) {
    return NextResponse.json(
      { ok: false, error: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, inserted: insertRows.length });
}
