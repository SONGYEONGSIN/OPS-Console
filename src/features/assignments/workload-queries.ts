import "server-only";
import { createClient } from "@/lib/supabase/server";
import { academicYearRangeKST } from "@/features/closing/academic-year";
import type { WorkloadSpan } from "./workload";
import {
  buildServiceCounts,
  buildSpans,
  type AnnouncementRow,
  type ClosingRow,
} from "./workload-sources";

/**
 * 배분현황의 건수·구간 원천(설계 §6.2).
 *
 * **학년도 창을 여기서 다시 정의하지 않는다** — `academicYearRangeKST` 가 마감
 * 스크랩과 같은 경계(3/1 00:01 ~ 익년 2월 말일 23:59 KST)를 쥐고 있다. 두 벌이
 * 되면 배분현황과 마감이 서로 다른 해를 보면서 둘 다 '올해' 라고 적는다.
 *
 * `services` 는 안 읽는다 — 왜인지는 `workload-sources.ts` 머리말에 있다.
 */

/** PostgREST Max-Rows cap. 한 번만 조회하면 뒤쪽 서비스가 조용히 사라진다. */
const CHUNK = 1000;
const MAX_PAGES = 20;

/** KST 오프셋을 붙인 경계 문자열. `timestamptz` 비교라 오프셋이 있어야 한다. */
const bound = (b: { date: string; time: string }) =>
  `${b.date}T${b.time}:00+09:00`;

import type { AssignmentQueryClient } from "./ledger-queries";

type Supabase = AssignmentQueryClient;

/**
 * 한 테이블을 끝까지 읽는다. **조회 실패를 빈 배열로 삼키지 않는다** — 삼키면
 * 전원의 건수가 0 이 되고, 화면에서 '일이 없다' 와 구분이 안 된다.
 */
async function pageAll<T>(
  supabase: Supabase,
  table: string,
  columns: string,
  dateColumn: string,
  from: string,
  to: string,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte(dateColumn, from)
      .lte(dateColumn, to)
      .range(p * CHUNK, p * CHUNK + CHUNK - 1);
    if (error) {
      throw new Error(`[assignments] ${label} 조회 실패: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < CHUNK) break;
  }
  return out;
}

export type WorkloadSources = {
  serviceCounts: Record<string, number>;
  spans: WorkloadSpan[];
};

/** 두 표에서 같은 칸을 읽는다 — 모양이 같아 하나의 select 문자열로 충분하다. */
const SERVICE_COLUMNS =
  "university_name, service_name, category, write_start_at, write_end_at";

/**
 * 한 학년도 창의 건수·구간. 표 이름을 **인자로 받는다** — 올해와 작년이 다른
 * 표에 있어서고, 두 벌로 적으면 한쪽만 컬럼이 늘어도 조용히 어긋난다.
 */
async function loadWindow(
  supabase: Supabase,
  table: string,
  from: string,
  to: string,
  label: string,
): Promise<WorkloadSources> {
  // 접수는 **시작 시각**으로 자른다 — 학년도 안에 시작한 접수가 그 해의 물량이다.
  const closing = await pageAll<ClosingRow>(
    supabase,
    table,
    SERVICE_COLUMNS,
    "write_start_at",
    from,
    to,
    label,
  );
  // 발표는 `last_announce_at` 이 서비스당 **가장 최근 한 칸**이라, 창 안에 아직
  // 발표가 없는 서비스는 여기서 안 잡힌다. 그 칸은 0 이 아니라 '못 셈' 으로
  // 드러난다(`WorkloadRow.uncounted`) — 0 으로 두면 '일이 없다' 로 읽힌다.
  const announcement = await pageAll<AnnouncementRow>(
    supabase,
    "announcement_services",
    "university_name",
    "last_announce_at",
    from,
    to,
    "발표",
  );

  return {
    serviceCounts: buildServiceCounts({ closing, announcement }),
    spans: buildSpans(closing),
  };
}

/** 올해 — 살아 있는 마감 미러에서 읽는다. */
export async function loadWorkloadSources(
  now: Date,
  client?: AssignmentQueryClient,
): Promise<WorkloadSources> {
  const { start, end } = academicYearRangeKST(now);
  const supabase = client ?? (await createClient());
  return loadWindow(
    supabase,
    "closing_services",
    bound(start),
    bound(end),
    "마감",
  );
}

/**
 * 작년 — **`services`(서비스목록)에서 읽는다.** 실측 2026-09-21: 2026학년도가
 * `services` 2,511건/313곳인데 `closing_services` 에는 2건뿐이다. 마감 미러는
 * 스크랩을 시작한 뒤부터만 쌓여서, 작년을 거기서 세면 통째로 '줄었다' 가 된다.
 */
export async function loadPreviousYearSources(
  now: Date,
  client?: AssignmentQueryClient,
): Promise<WorkloadSources> {
  const { start, end } = previousAcademicYearRange(now);
  const supabase = client ?? (await createClient());
  return loadWindow(
    supabase,
    "services",
    bound(start),
    bound(end),
    "서비스목록",
  );
}

/**
 * 직전 학년도 창. **3/1 의 하루 전**이 곧 그 해의 마지막 날이라, 경계를 여기서
 * 다시 정의하지 않고 `academicYearRangeKST` 에 되물어 얻는다 — 연도에서 1을 빼면
 * 윤년 2월 29일에서 갈린다.
 */
function previousAcademicYearRange(now: Date) {
  const { start } = academicYearRangeKST(now);
  const dayBefore = new Date(`${start.date}T00:00:00+09:00`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return academicYearRangeKST(dayBefore);
}
