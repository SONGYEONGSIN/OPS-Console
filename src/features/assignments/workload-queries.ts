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

/**
 * `services` 가 멈춘 학년도. 그 해까지는 **서비스목록**에, 그 다음부터는 **마감
 * 미러**에 물량이 있다(실측 2026-09-21: 2026학년도 `services` 2,511건 ↔
 * `closing_services` 2건 / 2027학년도 `services` 0건 ↔ `closing_services` 983건).
 *
 * **시계가 아니라 데이터의 사실이라 해가 넘어가도 안 움직인다.** `closing_services`
 * 는 지우지 않고 누적하므로 2028학년도가 와도 2027은 거기 그대로 있다.
 */
export const FROZEN_IMPORT_LAST_YEAR = 2026;

/**
 * 학년도 Y 의 창 — **Y-1년 3/1 ~ Y년 2월 말일.**
 *
 * 경계를 여기서 다시 정의하지 않고 `academicYearRangeKST` 에 되물어 얻는다.
 * 직접 만들면 윤년 2월 29일에서 갈리고(2028학년도), 마감 스크랩과 배분현황이
 * 서로 다른 해를 보면서 둘 다 '올해' 라고 적는다.
 *
 * 그 학년도 **한가운데의 아무 날**을 넘긴다 — 6월 1일이면 3월 시작·2월 끝 어느
 * 경계에도 안 걸린다.
 */
function rangeOfAcademicYear(academicYear: number) {
  return academicYearRangeKST(
    new Date(`${academicYear - 1}-06-01T00:00:00+09:00`),
  );
}

/** 그 학년도의 물량이 어느 표에 있는가. */
const tableOf = (academicYear: number) =>
  academicYear <= FROZEN_IMPORT_LAST_YEAR
    ? ({ table: "services", label: "서비스목록" } as const)
    : ({ table: "closing_services", label: "마감" } as const);

/** 한 학년도의 건수·구간. 표는 학년도가 고른다. */
export async function loadWorkloadSources(
  academicYear: number,
  client?: AssignmentQueryClient,
): Promise<WorkloadSources> {
  const { start, end } = rangeOfAcademicYear(academicYear);
  const { table, label } = tableOf(academicYear);
  const supabase = client ?? (await createClient());
  return loadWindow(supabase, table, bound(start), bound(end), label);
}

