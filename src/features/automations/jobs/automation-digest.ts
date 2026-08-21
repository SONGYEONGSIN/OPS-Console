import "server-only";
import { getAutomationStatuses } from "../queries";
import { getAutomationRunLog } from "../run-logs";
import { buildDigest, renderDigestHtml, isSameKstDay } from "../digest";
import { renderPollerSection } from "../digest-pollers";
import { loadPollerStatuses } from "@/features/system-status/queries";
import type { DigestInput } from "../digest";
import { sendAutomationReport } from "../report-send";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 자동화 일일 보고.
 *
 * 실패 즉시 알림이 못 잡는 구멍을 메운다: 잡이 아예 안 돌면 실패 이벤트가 없어 알림이
 * 뜰 수가 없다(cron 등록 누락·회사 PC 꺼짐·스케줄러 죽음). 그래서 실행 결과뿐 아니라
 * '마지막 실행이 주기에 비해 너무 오래됐나'까지 함께 본다.
 *
 * 집계 대상은 registry 전체다. `getAutomationStatuses`를 쓰는 이유는 그게 이미
 * automation_runs와 잡별 결과 테이블 두 갈래를 합쳐 마지막 실행을 내주기 때문 —
 * 회사 PC 잡(서비스 마감 등)도 같은 경로로 잡힌다.
 */

export const AUTOMATION_DIGEST_JOB_ID = "automation-digest";

export async function runAutomationDigest(): Promise<AutomationRunResult> {
  const now = new Date();
  const statuses = await getAutomationStatuses();

  const inputs: DigestInput[] = [];
  for (const s of statuses) {
    if (s.id === AUTOMATION_DIGEST_JOB_ID) continue; // 보고가 보고를 보고하지 않게
    const runs = await getAutomationRunLog(s.id);
    inputs.push({
      job: {
        id: s.id,
        label: s.label,
        cadence: s.cadence,
        manualOnly: s.manualOnly,
      },
      enabled: s.enabled,
      lastRunAt: s.lastRunAt,
      todayRuns: runs.filter((r) => isSameKstDay(r.ranAt, now)),
    });
  }

  const states = buildDigest(inputs, now);
  const failed = states.filter((s) => s.status === "failed").length;
  const stale = states.filter((s) => s.status === "stale").length;
  // 회사 PC 폴러도 함께 본다 — 심박이 없으면 아무도 모른 채 하루가 간다.
  //
  // 실패해도 보고는 보낸다. 폴러 상태를 못 읽었다고 자동화 보고까지 막으면
  // 더 큰 것을 놓친다.
  let pollerHtml = "";
  let pollerSummary = "";
  try {
    const pollers = await loadPollerStatuses(now);
    pollerHtml = renderPollerSection(
      pollers.map((p) => ({
        id: p.id,
        label: p.label,
        verdict: p.verdict,
        detail: p.detail,
        hint: p.hint,
      })),
    );
    const down = pollers.filter((p) => p.verdict === "stopped").length;
    pollerSummary = ` · 폴러 멈춤 ${down}`;
  } catch (e) {
    console.error("[digest] 폴러 상태를 읽지 못했습니다:", e);
    pollerSummary = " · 폴러 상태 조회 실패";
  }

  const summary = `잡 ${states.length} · 실패 ${failed} · 미실행 ${stale}${pollerSummary}`;

  const send = await sendAutomationReport(
    renderDigestHtml(states, now) + pollerHtml,
  );
  if (send.dryRun)
    return { ok: true, message: `${summary} (DRY RUN — 미발송)` };
  if (!send.sent)
    return { ok: false, message: `${summary} — 발송 실패: ${send.error}` };
  return { ok: true, message: `${summary} — 발송 완료` };
}
