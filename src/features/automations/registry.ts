import "server-only";
import type { AutomationJob } from "./types";
import { runInsightsCollect } from "./jobs/insights-collect";
import { runReceivablesMailOperator } from "./jobs/receivables-mail-operator";
import { runReceivablesDepositMatch } from "./jobs/receivables-deposit-match";
import { runServiceNoticeMail } from "./jobs/service-notice-mail";
import { runWeeklyReportRollover } from "./jobs/weekly-report";

export const AUTOMATION_JOBS: AutomationJob[] = [
  {
    id: "insights-collect",
    label: "인사이트 영상 수집",
    description:
      "YouTube에서 키워드별 인기 영상을 수집해 인사이트 페이지에 적재합니다.",
    scheduleInfo: "매일 08:00 자동 (cron-job.org)",
    cooldownMinutes: 60,
    run: runInsightsCollect,
  },
  {
    id: "receivables-mail-operator",
    label: "운영자 미수채권 알림",
    description:
      "운영자별 미수채권(경과 10일 이상)을 운영자 본인 메일박스로 발송합니다. MAIL_DRY_RUN=true 시 발송 없이 이력만 적재.",
    scheduleInfo: "평일 10:00 자동 (cron-job.org)",
    cooldownMinutes: 60,
    run: runReceivablesMailOperator,
  },
  {
    id: "receivables-deposit-match",
    label: "입금 매칭 자동화",
    description:
      "SharePoint 미수채권 ↔ 입금내역 시트를 매칭(단건/N:1/N:M)하여 K/J열을 자동 업데이트. MAIL_MATCH_DRY_RUN=true(default) 시 PATCH skip + 이력만 적재.",
    scheduleInfo: "매시간 자동 (cron-job.org)",
    cooldownMinutes: 30,
    run: runReceivablesDepositMatch,
  },
  {
    id: "service-notice-mail",
    label: "월별 서비스 알림",
    description:
      "다음 달 작성시작 서비스를 운영자 본인 메일박스로 요약 발송합니다 (매월 첫 영업일 1회, 월 단위 중복 방지). MAIL_DRY_RUN=true 시 발송 없이 이력만 적재.",
    scheduleInfo: "매월 첫 영업일 10:00 (cron-job.org)",
    cooldownMinutes: 60,
    run: runServiceNoticeMail,
  },
  {
    id: "weekly-report-rollover",
    label: "본부차주보고 알림",
    description:
      "직전 주차 주간업무보고서를 차주로 롤오버(파일 복제 + 시트/셀 갱신)하고 공유 링크를 Teams 그룹채팅에 발송합니다.\nWEEKLY_REPORT_DRY_RUN=true(기본) 시 발송 없이 차주명·발송자만 보고. 발송자는 임형섭→전성대→허승철 부장 순환.",
    scheduleInfo: "매주 수요일 10:00 (cron-job.org)",
    cooldownMinutes: 60,
    run: runWeeklyReportRollover,
  },
];

export function getJob(id: string): AutomationJob | undefined {
  return AUTOMATION_JOBS.find((j) => j.id === id);
}
