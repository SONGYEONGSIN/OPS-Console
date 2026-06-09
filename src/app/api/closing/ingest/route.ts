import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { closingIngestSchema } from "@/features/closing/schemas";

/**
 * 서비스 마감 스크래퍼 인제스트 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 스크래퍼가 "현재 마감된 전체 스냅샷"을 보낸다.
 * 적재 전략: 신규만 누적 — service_id(멱등 키) 충돌은 무시하고 기존에 없던 건만 insert.
 * 한 번 적재된 마감 건은 이후 검색 결과에서 빠져도 유지(이력 누적). 빈 배열은 zod에서 거부.
 * 응답 inserted = 이번에 실제로 새로 추가된 건수, received = 보낸 전체 건수.
 *
 * service_role(RLS bypass) admin client로만 쓰기. secret 누설 시 임의 주입 가능하나
 * 데이터는 read-only 표시라 영향은 위변조 한정.
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

  const parsed = closingIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { scraped_at, rows } = parsed.data;
  const supabase = createAdminClient();

  // 신규만 누적 — 기존 적재분은 유지하고 새 service_id만 추가(중복은 무시). scraped_at은
  // 이번 배치에서 처음 들어오는 행에 부여(이미 있던 행은 ignoreDuplicates로 갱신 안 됨).
  const insertRows = rows.map((r) => ({
    service_id: r.service_id,
    university_name: r.university_name,
    region: r.region ?? null,
    service_name: r.service_name,
    university_type: r.university_type ?? null,
    category: r.category ?? null,
    admission_type: r.admission_type ?? null,
    operator_name: r.operator_name ?? null,
    developer_name: r.developer_name ?? null,
    write_start_at: r.write_start_at ?? null,
    write_end_at: r.write_end_at,
    pay_start_at: r.pay_start_at ?? null,
    pay_end_at: r.pay_end_at ?? null,
    solo: r.solo,
    scraped_at,
  }));

  // service_id 충돌(이미 적재된 건)은 무시하고 신규만 insert. select로 실제 신규 건수 회수.
  const { data, error: upsertError } = await supabase
    .from("closing_services")
    .upsert(insertRows, { onConflict: "service_id", ignoreDuplicates: true })
    .select("service_id");
  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: upsertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    received: insertRows.length,
    inserted: data?.length ?? 0,
  });
}
