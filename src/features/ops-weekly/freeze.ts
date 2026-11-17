import "server-only";

/**
 * 자동 항목 굳히기 — 당번의 [최종 보고] 때 그 주 보고서 전원의 `AutoSnapshot` 을 한꺼번에 쓴다.
 * 제출 때 굳히면 수요일 수집 전에 낸 보고서가 `구분 미확인` 으로 굳고, 같은 주 보고서끼리 기준 시각이 갈린다.
 *
 * 전원 것을 **먼저 다 만든 뒤에** 쓴다 — 만들기가 하나라도 실패하면 아무것도 안 쓰고 던진다.
 * 쓰기는 한 건씩이라 중간에 실패하면 앞선 보고서는 이미 굳었을 수 있다. 그래도 던지므로
 * 부르는 쪽(`finalizeWeek`)은 주를 `reported` 로 바꾸지 않고 이벤트도 안 낸다(주는 open 으로 남는다).
 * 일반 주는 다시 누르면 전원을 다시 굳힌다(덮어 쓴다). 정정 주는 비어 있는 것만 채운다.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAutoSnapshot } from "./auto-queries";
import { normEmail } from "./email";
import type { AutoSnapshot } from "./merge";
import type { WriterCandidate } from "./roster";
import type { ReportRow, WeekRow } from "./schemas";

type Target = { report: ReportRow; writer: WriterCandidate };

/**
 * 대상 = 작성자 명단에 있는 사람의 보고서.
 * 정정(재오픈) 뒤 다시 보고할 때는 굳은 값을 두고 비어 있는 것만 채운다.
 */
function targetsOf(
  week: WeekRow,
  writers: readonly WriterCandidate[],
  reports: readonly ReportRow[],
): Target[] {
  const byEmail = new Map(writers.map((w) => [w.email, w]));
  const correction = week.reopened_at !== null;
  return reports.flatMap((report) => {
    const writer = byEmail.get(normEmail(report.operator_email));
    if (writer === undefined) return [];
    if (correction && report.snapshot !== null) return [];
    return [{ report, writer }];
  });
}

/**
 * `updated_by` 는 바꾸지 않는다 — 사람이 쓴 게 아니다. 쓴 행이 있으면 true.
 * 정정 주는 비어 있을 때만 쓴다(`is null`) — 동시에 누른 다른 [최종 보고] 가 방금 굳힌 값을 덮지 않는다.
 * 그때 0행은 '이미 누가 굳혔다' 이므로 오류가 아니다. 일반 주는 전원을 덮어 쓴다(제출 때 굳은 옛 값 포함).
 */
async function writeSnapshot(
  reportId: string,
  snapshot: AutoSnapshot,
  correction: boolean,
): Promise<boolean> {
  const base = createAdminClient()
    .from("ops_weekly_reports")
    .update({ snapshot })
    .eq("id", reportId);
  const res = await (correction ? base.is("snapshot", null) : base).select(
    "id",
  );
  if (res.error) throw new Error(`스냅샷 저장 실패: ${res.error.message}`);
  if (((res.data as unknown[] | null) ?? []).length > 0) return true;
  if (correction) return false;
  throw new Error(`스냅샷을 쓸 보고서를 찾지 못했습니다(${reportId}).`);
}

/** 이번 호출이 굳힌 보고서 수를 돌려준다(정정 주에서 다른 요청이 먼저 굳힌 것은 세지 않는다). */
export async function freezeWeekSnapshots(args: {
  week: WeekRow;
  writers: readonly WriterCandidate[];
  reports: readonly ReportRow[];
  now: Date;
}): Promise<number> {
  const { week, writers, reports, now } = args;
  const targets = targetsOf(week, writers, reports);
  const writerNames: ReadonlySet<string> = new Set(writers.map((w) => w.name));
  const snapshots = await Promise.all(
    targets.map(({ writer }) =>
      loadAutoSnapshot({
        weekStart: week.week_start,
        operatorEmail: writer.email,
        operatorName: writer.name,
        writerNames,
        now,
      }),
    ),
  );
  const correction = week.reopened_at !== null;
  // 한 건씩 쓴다 — 중간에 던지면 앞선 건은 굳은 채 남는다(위 머리 주석).
  let written = 0;
  for (const [i, { report }] of targets.entries()) {
    if (await writeSnapshot(report.id, snapshots[i], correction)) written += 1;
  }
  return written;
}
