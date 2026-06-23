import "server-only";
import type { AutomationJob } from "./types";
import { runInsightsCollect } from "./jobs/insights-collect";
import { runReceivablesMailOperator } from "./jobs/receivables-mail-operator";
import { runReceivablesMailSchool } from "./jobs/receivables-mail-school";
import { runReceivablesDepositMatch } from "./jobs/receivables-deposit-match";
import { runServiceNoticeMail } from "./jobs/service-notice-mail";
import { runWeeklyReportRollover } from "./jobs/weekly-report";
import { runSmileEdiMail } from "./jobs/smileedi-mail";
import { runClosingScrape } from "./jobs/closing-scrape";
import { runNewsCollect } from "./jobs/news-collect";

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
    scheduleInfo: "평일 10:00 (cron-job.org → 스크래핑 → 자동 메일 발송)",
    cooldownMinutes: 60,
    run: runSmileEdiMail,
  },
  {
    id: "closing-scrape",
    label: "서비스 마감 스크래핑",
    description:
      "Moa 서비스조회를 스크래핑해 작성마감이 지난 서비스를 '서비스 마감' 페이지에 적재합니다.\n회사 PC 예약 작업(Windows 작업 스케줄러)이 직접 실행합니다 — Cloudflare 차단으로 웹·GitHub Actions로는 실행 불가. 격주 스킵은 스크래퍼가 판정합니다.",
    scheduleInfo: "매주 월요일 10:00 (회사 PC 로컬 예약 작업 · 격주)",
    cooldownMinutes: 60,
    run: runClosingScrape,
  },
  {
    id: "news-collect",
    label: "운영부 뉴스 수집",
    description:
      "대학 관련 뉴스(통폐합·폐교·정원감축 등)를 멀티소스 RSS로 수집해 운영부 뉴스 페이지에 적재합니다.",
    scheduleInfo: "평일 06~18시 매시 (cron-job.org)",
    cooldownMinutes: 30,
    run: runNewsCollect,
  },
  {
    id: "mailbox-ingest",
    label: "메일함 AI 초안 생성",
    description:
      "운영자 수신함을 수집하고 외부 고객 메일에 AI 회신 초안을 생성합니다.\n로컬 LLM(Ollama)을 쓰므로 서버리스가 아닌 로컬 머신(Mac mini) cron에서만 실행됩니다.",
    scheduleInfo: "로컬 cron (Mac mini · launchd)",
    cooldownMinutes: 0,
    localOnly: true,
    // 로컬 전용 — 서버리스로는 Ollama에 닿지 못한다. 잘못 호출돼도 실행하지 않고 안내만 반환.
    run: async () => ({
      ok: false,
      message:
        "로컬 전용 자동화입니다. Mac mini의 로컬 cron(Ollama)에서 실행되며, 여기서는 실행할 수 없습니다.",
    }),
  },
];

export function getJob(id: string): AutomationJob | undefined {
  return AUTOMATION_JOBS.find((j) => j.id === id);
}
