import "server-only";

/**
 * 자동 항목 굳히기 — 당번의 [최종 보고] 때 그 주 보고서 전원의 `AutoSnapshot` 을 한꺼번에 쓴다.
 * 제출 때 굳히면 수요일 수집 전에 낸 보고서가 `구분 미확인` 으로 굳고, 같은 주 보고서끼리 기준 시각이 갈린다.
 *
 * 전원 것을 **먼저 다 만든 뒤에** 쓴다 — 하나라도 실패하면 아무것도 안 쓰고 던진다.
 * 부르는 쪽(`finalizeWeek`)은 던지면 주를 `reported` 로 바꾸지 않는다(반쯤 보고된 주를 만들지 않는다).
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

/** `updated_by` 는 바꾸지 않는다 — 사람이 쓴 게 아니다. */
async function writeSnapshot(
  reportId: string,
  snapshot: AutoSnapshot,
): Promise<void> {
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .update({ snapshot })
    .eq("id", reportId)
    .select("id");
  if (res.error) throw new Error(`스냅샷 저장 실패: ${res.error.message}`);
  if (((res.data as unknown[] | null) ?? []).length === 0) {
    throw new Error(`스냅샷을 쓸 보고서를 찾지 못했습니다(${reportId}).`);
  }
}

/** 굳힌 보고서 수를 돌려준다. */
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
  for (const [i, { report }] of targets.entries()) {
    await writeSnapshot(report.id, snapshots[i]);
  }
  return targets.length;
}
