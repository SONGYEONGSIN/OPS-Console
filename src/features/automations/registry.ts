import "server-only";
import type { AutomationJob } from "./types";
import { runInsightsCollect } from "./jobs/insights-collect";
import { runReceivablesMailOperator } from "./jobs/receivables-mail-operator";
import { runReceivablesMailSchool } from "./jobs/receivables-mail-school";
import { runReceivablesDepositMatch } from "./jobs/receivables-deposit-match";
import { runServiceNoticeMail } from "./jobs/service-notice-mail";
import { runWeeklyReportRollover } from "./jobs/weekly-report";
import { runSmileEdiMail } from "./jobs/smileedi-mail";

export const AUTOMATION_JOBS: AutomationJob[] = [
  {
    id: "insights-collect",
    label: "인사이트 영상 수집",
    description:
      "YouTube에서 키워드별 인기 영상을 수집해 인사이트 페이지에 적재합니다.",
    scheduleInfo: "매주 월요일 10:00 자동 (cron-job.org)",
    cooldownMinutes: 60,
    run: runInsightsCollect,
  },
  {
    id: "receivables-mail-operator",
    label: "운영자 미수채권 알림",
    description:
      "경과 10일 이상 미수채권을 담당 운영자 본인 메일로 발송합니다.",
    scheduleInfo: "평일 10:00 자동 (cron-job.org)",
    cooldownMinutes: 60,
    run: runReceivablesMailOperator,
  },
  {
    id: "receivables-mail-school",
    label: "학교담당자 미수채권 알림",
    description:
      "미수채권을 경과일수 마일스톤에 따라 담당 운영자 메일박스에서 학교담당자에게 자동 독려합니다.\n학교담당자 메일주소가 등록된 건만 발송하며, 발송 시 엑셀 '메일발송일자'를 기록합니다.",
    scheduleInfo: "평일 10:00 자동 (cron-job.org)",
    cooldownMinutes: 60,
    run: runReceivablesMailSchool,
  },
  {
    id: "receivables-deposit-match",
    label: "입금 매칭 자동화",
    description:
      "미수채권과 입금내역을 자동 매칭해 정산 시트를 갱신하고, 매칭되지 않은 건은 관리자에게 알립니다.",
    scheduleInfo: "매시간 자동 (cron-job.org)",
    cooldownMinutes: 30,
    run: runReceivablesDepositMatch,
  },
  {
    id: "service-notice-mail",
    label: "월별 서비스 알림",
    description:
      "다음 달 작성 시작 서비스를 담당 운영자 본인 메일로 요약 발송합니다.",
    scheduleInfo: "매월 첫 영업일 10:00 (cron-job.org)",
    cooldownMinutes: 60,
    run: runServiceNoticeMail,
  },
  {
    id: "weekly-report-rollover",
    label: "본부차주보고 알림",
    description:
      "직전 주 주간업무보고서를 다음 주 파일로 복제·갱신하고 공유 링크를 Teams 그룹채팅에 발송합니다.\n발송 담당은 임형섭→전성대→허승철 부장 순으로 순환합니다.",
    scheduleInfo: "매주 수요일 10:00 (cron-job.org)",
    cooldownMinutes: 60,
    run: runWeeklyReportRollover,
  },
  {
    id: "smileedi-mail",
    label: "세금계산서 역발행 알림",
    description:
      "역발행 세금계산서를 담당자별로 묶어 담당 운영자 본인 메일박스에서 발송하고, 발송 건의 이메일오류를 'Y'로 갱신합니다.\n스크래핑(GitHub Actions)이 시트를 적재한 뒤 자동 호출됩니다.",
    scheduleInfo: "스크래핑 워크플로 말미 체이닝 (cron-job.org → GitHub Actions)",
    cooldownMinutes: 60,
    run: runSmileEdiMail,
  },
];

export function getJob(id: string): AutomationJob | undefined {
  return AUTOMATION_JOBS.find((j) => j.id === id);
}
