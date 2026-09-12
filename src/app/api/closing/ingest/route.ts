import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  closingIngestSchema,
  type ClosingIngestRow,
} from "@/features/closing/schemas";
import {
  CLOSING_DIFF_FIELDS,
  closingComparableSchema,
  diffClosingRow,
  type ClosingComparable,
} from "@/features/closing/diff-row";

/**
 * 서비스 마감 스크래퍼 인제스트 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 스크래퍼가 "현재 마감된 전체 스냅샷"을 보낸다.
 *
 * 적재 전략: **신규는 추가, 기존은 바뀐 것만 갱신**.
 * 예전엔 `ignoreDuplicates: true` 라 한 번 적재된 service_id 는 통째로 건너뛰었고,
 * 그래서 값이 바뀌어도 영영 반영되지 않았다(국립군산대 1035061 의 solo 가
 * 몇 달째 false 였다). 이제 배치의 service_id 로 기존 행을 먼저 읽어
 * `diffClosingRow` 로 비교하고, **바뀐 행만** 갱신한 뒤 바뀐 칸을
 * `closing_service_changes` 에 남긴다.
 *
 * - 안 바뀐 행은 건드리지 않는다 — 900여 행의 `updated_at` 을 매 실행 흔들 이유가 없다.
 * - 전 행을 무조건 upsert 하지 않는 이유도 같다: 그러면 무엇이 바뀌었는지 알 수 없어
 *   이력을 못 남긴다.
 * - 한 번 적재된 마감 건은 이후 검색 결과에서 빠져도 유지(이력 누적). 빈 배열은 zod에서 거부.
 *
 * 배포 후 **첫 실행은 몇 달치 누적 드리프트를 한꺼번에 잡아낸다** — 버그가 아니라 의도다.
 * 그 규모가 응답(updated/changes)에 드러나고 스크래퍼가 run-log 에 찍는다.
 *
 * 응답: received = 보낸 전체 건수 / inserted = 새로 추가된 건수 /
 *       updated = 값이 달라 갱신한 건수 / changes = 남긴 변경 칸 수.
 *
 * service_role(RLS bypass) admin client로만 쓰기. secret 누설 시 임의 주입 가능하나
 * 데이터는 read-only 표시라 영향은 위변조 한정.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

type ClosingDbRow = {
  service_id: number;
  university_name: string;
  region: string | null;
  service_name: string;
  university_type: string | null;
  category: string | null;
  admission_type: string | null;
  operator_name: string | null;
  developer_name: string | null;
  write_start_at: string | null;
  write_end_at: string;
  pay_start_at: string | null;
  pay_end_at: string | null;
  solo: boolean;
  scraped_at: string;
};

type ChangeRow = {
  service_id: number;
  field: string;
  prev_value: string | null;
  next_value: string | null;
  scraped_at: string;
};

/** `.in()` 은 GET 쿼리스트링으로 나가 URL 길이 제한(414)에 걸린다 — 나눠 읽는다. */
const SELECT_CHUNK = 500;
/** 첫 실행의 이력은 수천 행이 한꺼번에 나온다 — 한 요청에 몰지 않는다. */
const CHANGE_CHUNK = 1000;

const SELECT_COLUMNS = ["service_id", ...CLOSING_DIFF_FIELDS].join(", ");

function toDbRow(r: ClosingIngestRow, scrapedAt: string): ClosingDbRow {
  return {
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
    scraped_at: scrapedAt,
  };
}

/** 배치의 service_id 에 해당하는 기존 행만 읽어 map 으로. */
async function fetchExisting(
  supabase: AdminClient,
  ids: number[],
): Promise<
  { ok: true; rows: Map<number, ClosingComparable> } | { ok: false; error: string }
> {
  const rows = new Map<number, ClosingComparable>();
  for (let i = 0; i < ids.length; i += SELECT_CHUNK) {
    const { data, error } = (await supabase
      .from("closing_services")
      .select(SELECT_COLUMNS)
      .in("service_id", ids.slice(i, i + SELECT_CHUNK))) as {
      data: unknown[] | null;
      error: { message: string } | null;
    };
    if (error) return { ok: false, error: error.message };
    for (const row of data ?? []) {
      const parsed = closingComparableSchema.safeParse(row);
      // 컬럼이 빠지면 전 행이 "null 로 바뀜"으로 잡혀 이력이 오염된다 — 조용히 넘기지 않는다.
      if (!parsed.success) {
        return {
          ok: false,
          error: `closing_services read 형식 불일치: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        };
      }
      rows.set(parsed.data.service_id, parsed.data);
    }
  }
  return { ok: true, rows };
}

/** 신규/갱신 대상과 남길 변경 칸을 가른다. */
function partition(
  rows: ClosingIngestRow[],
  existing: Map<number, ClosingComparable>,
  scrapedAt: string,
) {
  const inserts: ClosingDbRow[] = [];
  const updates: ClosingDbRow[] = [];
  const changes: ChangeRow[] = [];
  for (const r of rows) {
    const prev = existing.get(r.service_id);
    if (!prev) {
      inserts.push(toDbRow(r, scrapedAt));
      continue;
    }
    const diff = diffClosingRow(prev, r);
    if (diff.length === 0) continue; // 안 바뀐 행은 건드리지 않는다
    updates.push(toDbRow(r, scrapedAt));
    for (const c of diff) {
      changes.push({
        service_id: r.service_id,
        field: c.field,
        prev_value: c.prev_value,
        next_value: c.next_value,
        scraped_at: scrapedAt,
      });
    }
  }
  return { inserts, updates, changes };
}

async function upsertClosing(
  supabase: AdminClient,
  rows: ClosingDbRow[],
  options: { onConflict: string; ignoreDuplicates?: boolean },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("closing_services")
    .upsert(rows, options)
    .select("service_id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data?.length ?? 0 };
}

async function insertChanges(
  supabase: AdminClient,
  rows: ChangeRow[],
): Promise<string | null> {
  for (let i = 0; i < rows.length; i += CHANGE_CHUNK) {
    const { error } = await supabase
      .from("closing_service_changes")
      .insert(rows.slice(i, i + CHANGE_CHUNK));
    if (error) return error.message;
  }
  return null;
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET 환경 변수 미설정", 500);

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return fail("unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid json", 400);
  }

  const parsed = closingIngestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "invalid", 400);
  }

  const { scraped_at, rows } = parsed.data;
  const supabase = createAdminClient();

  // 같은 service_id 가 한 배치에 두 번 오면 갱신 upsert 가
  // "cannot affect row a second time" 으로 통째로 실패한다 — 마지막 행만 남긴다.
  const byId = new Map<number, ClosingIngestRow>();
  for (const r of rows) byId.set(r.service_id, r);
  const unique = [...byId.values()];

  const existing = await fetchExisting(supabase, [...byId.keys()]);
  if (!existing.ok) return fail(existing.error, 500);

  const { inserts, updates, changes } = partition(
    unique,
    existing.rows,
    scraped_at,
  );

  // 신규 — service_id 충돌은 무시(조회~적재 사이에 끼어든 행에 대한 방어).
  let inserted = 0;
  if (inserts.length > 0) {
    const res = await upsertClosing(supabase, inserts, {
      onConflict: "service_id",
      ignoreDuplicates: true,
    });
    if (!res.ok) return fail(res.error, 500);
    inserted = res.count;
  }

  // 갱신 — 값이 실제로 달라진 행만.
  let updated = 0;
  if (updates.length > 0) {
    const res = await upsertClosing(supabase, updates, {
      onConflict: "service_id",
    });
    if (!res.ok) return fail(res.error, 500);
    updated = res.count;
  }

  // 이력은 갱신 뒤에 남긴다. 순서를 뒤집으면 갱신이 실패했을 때 "바뀌었다"는
  // 거짓 이력이 남는다 — 이력이 비는 쪽이 거짓말하는 쪽보다 낫다.
  // 실패는 500 으로 드러내고 스크래퍼 run-log 에 실패로 잡히게 한다.
  if (changes.length > 0) {
    const changeError = await insertChanges(supabase, changes);
    if (changeError) return fail(changeError, 500);
  }

  return NextResponse.json({
    ok: true,
    received: rows.length,
    inserted,
    updated,
    changes: changes.length,
  });
}
