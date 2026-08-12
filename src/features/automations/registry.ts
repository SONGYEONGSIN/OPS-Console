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
import { runRatioAudit } from "./jobs/ratio-audit";
import { runRatioPageCheck } from "./jobs/ratio-page-check";
import { runNewsCollect } from "./jobs/news-collect";
import { runNoticeTeamsShare } from "./jobs/notice-teams-share";
import { runTeamBriefing } from "./jobs/team-briefing";
import { runContractCompletionSnapshot } from "./jobs/contract-completion-snapshot";
// 이 잡은 registry 전체를 훑어야 해서 queries → registry 순환이 생긴다. queries가
// AUTOMATION_JOBS를 함수 안에서만 읽으므로 평가 순서와 무관하게 안전하다.
import { runAutomationDigest } from "./jobs/automation-digest";

export const AUTOMATION_JOBS: AutomationJob[] = [
  {
    id: "insights-collect",
    label: "인사이트 영상 수집",
    description:
      "YouTube에서 키워드별 인기 영상을 수집해 인사이트 페이지에 적재합니다.",
    scheduleInfo: "매주 월요일 10:00 자동 (cron-job.org)",
    cadence: "weekly",
    cooldownMinutes: 60,
    run: runInsightsCollect,
  },
  {
    id: "receivables-mail-operator",
    label: "운영자 미수채권 알림",
    description:
      "경과 10일 이상 미수채권을 담당 운영자 본인 메일로 발송합니다.",
    scheduleInfo: "평일 10:00 자동 (cron-job.org)",
    cadence: "weekday",
    cooldownMinutes: 60,
    run: runReceivablesMailOperator,
  },
  {
    id: "receivables-mail-school",
    label: "학교담당자 미수채권 알림",
    description:
      "미수채권을 경과일수 마일스톤에 따라 담당 운영자 메일박스에서 학교담당자에게 자동 독려합니다.\n학교담당자 메일주소가 등록된 건만 발송하며, 발송 시 엑셀 '메일발송일자'를 기록합니다.",
    scheduleInfo: "평일 10:00 자동 (cron-job.org)",
    cadence: "weekday",
    cooldownMinutes: 60,
    run: runReceivablesMailSchool,
  },
  {
    id: "receivables-deposit-match",
    label: "입금 매칭 자동화",
    description:
      "미수채권과 입금내역을 자동 매칭해 정산 시트를 갱신하고, 매칭되지 않은 건은 관리자에게 알립니다.",
    scheduleInfo: "매시간 자동 (cron-job.org)",
    cadence: "hourly",
    cooldownMinutes: 30,
    run: runReceivablesDepositMatch,
  },
  {
    id: "service-notice-mail",
    label: "월별 서비스 알림",
    description:
      "다음 달 작성 시작 서비스를 담당 운영자 본인 메일로 요약 발송합니다.",
    scheduleInfo: "매월 첫 영업일 10:00 (cron-job.org)",
    cadence: "monthly",
    cooldownMinutes: 60,
    run: runServiceNoticeMail,
  },
  {
    id: "weekly-report-rollover",
    label: "본부차주보고 알림",
    description:
      "직전 주 주간업무보고서를 다음 주 파일로 복제·갱신하고 공유 링크를 Teams 그룹채팅에 발송합니다.\n발송 담당은 임형섭→전성대→허승철 부장 순으로 순환합니다.",
    scheduleInfo: "매주 수요일 10:00 (cron-job.org)",
    cadence: "weekly",
    cooldownMinutes: 60,
    run: runWeeklyReportRollover,
  },
  {
    id: "smileedi-mail",
    label: "세금계산서 역발행 알림",
    description:
      "역발행 세금계산서를 담당자별로 묶어 담당 운영자 본인 메일박스에서 발송하고, 발송 건의 이메일오류를 'Y'로 갱신합니다.\n스크래핑(GitHub Actions)이 시트를 적재한 뒤 자동 호출됩니다.",
    scheduleInfo: "평일 10:00 (cron-job.org → 스크래핑 → 자동 메일 발송)",
    cadence: "weekday",
    cooldownMinutes: 60,
    run: runSmileEdiMail,
  },
  {
    id: "closing-scrape",
    label: "서비스 마감 스크래핑",
    description:
      "Moa 서비스조회를 스크래핑해 작성마감이 지난 서비스를 '서비스 마감' 페이지에 적재합니다.\n회사 PC 예약 작업이 직접 실행합니다 — 웹·GitHub Actions는 Cloudflare 차단으로 실행 불가.\n여기서 '실행'을 누르면 로컬 실행 요청만 적재되고, 회사 PC 폴러가 5분 내 처리합니다.",
    scheduleInfo: "평일 09:00 (회사 PC 로컬 예약 작업)",
    cadence: "weekday",
    cooldownMinutes: 60,
    run: runClosingScrape,
  },
  {
    id: "ratio-audit",
    label: "경쟁률 세팅 점검",
    description:
      "Moa TEST 서버의 경쟁률 세팅(스케줄·안내 문구·접수일정)을 대조해 오설정을 담당 운영자 Teams 개인 채팅으로 알립니다.\n경쟁률 페이지(링크) 상태는 '경쟁률 페이지 점검'에서 따로 실행합니다.\n회사 PC 폴러가 직접 실행합니다 — 브라우저·Moa 로그인·로컬 claude 판정이 필요해 웹·GitHub Actions에서 실행 불가.\n여기서 '실행'을 누르면 로컬 실행 요청만 적재되고, 회사 PC 폴러가 5분 내 처리합니다. 자동 스케줄이 없어 이 버튼을 눌러야만 발송됩니다.\n담당 미상·발송 실패·링크오류는 관리자 채팅으로 취합됩니다.",
    scheduleInfo: "수동 실행 — 로컬 폴러가 수행 (cron 미등록)",
    cadence: "manual",
    cooldownMinutes: 60,
    manualOnly: true,
    run: runRatioAudit,
  },
  {
    id: "ratio-page-check",
    label: "경쟁률 페이지 점검",
    description:
      "REAL 서버의 경쟁률 HTML 페이지가 정상 응답하는지 점검해 담당 운영자 Teams 개인 채팅으로 알립니다.\n세팅 점검과 같은 회사 PC 폴러가 수행합니다 — 목록 조회에 Moa 로그인이 필요해 웹에서 실행 불가.\n여기서 '실행'을 누르면 로컬 실행 요청만 적재되고, 회사 PC 폴러가 5분 내 처리합니다.\n세팅 점검과 동시에는 실행되지 않습니다(같은 계정으로 로그인해 세션이 충돌).",
    scheduleInfo: "수동 실행 — 로컬 폴러가 수행 (cron 미등록)",
    cadence: "manual",
    cooldownMinutes: 60,
    manualOnly: true,
    run: runRatioPageCheck,
  },
  {
    id: "news-collect",
    label: "운영부 뉴스 수집",
    description:
      "대학 관련 뉴스(통폐합·폐교·정원감축 등)를 멀티소스 RSS로 수집해 운영부 뉴스 페이지에 적재합니다.",
    scheduleInfo: "평일 06~18시 매시 (cron-job.org)",
    cadence: "hourly",
    cooldownMinutes: 30,
    run: runNewsCollect,
  },
  {
    id: "mailbox-ingest",
    label: "메일함 AI 초안 생성",
    description:
      "운영자 수신함을 수집하고 외부 고객 메일에 AI 회신 초안을 생성합니다.\n로컬 claude CLI(-p)를 쓰므로 서버리스가 아닌 회사 PC(Windows 작업 스케줄러)에서 실행됩니다.",
    scheduleInfo: "회사 PC Windows 작업 스케줄러 (claude CLI)",
    cadence: "hourly",
    cooldownMinutes: 0,
    localOnly: true,
    // 로컬 전용 — 서버리스로는 로컬 claude CLI에 닿지 못한다. 잘못 호출돼도 실행하지 않고 안내만 반환.
    run: async () => ({
      ok: false,
      message:
        "로컬 전용 자동화입니다. 회사 PC(Windows 작업 스케줄러, claude CLI)에서 실행되며, 여기서는 실행할 수 없습니다.",
    }),
  },
  {
    id: "notice-teams-share",
    label: "운영부 공지",
    description:
      "새로 작성된 공지사항을 감지해 Teams 그룹채팅에 자동 공유합니다.",
    scheduleInfo: "30분 간격 (cron-job.org)",
    cadence: "hourly",
    cooldownMinutes: 30,
    run: runNoticeTeamsShare,
  },
  {
    id: "team-briefing",
    label: "팀 뉴스레터",
    description:
      "계약진행 현황(누적)·차주 팀 업무(일정/서비스 마감)·AI 활용(내 AI 작업/TIP/인사이트)을 집계해 주간 뉴스레터 초안을 만듭니다. [발행]으로 확정해야 Teams 그룹채팅에 티저가 나갑니다.",
    scheduleInfo: "매주 금요일 10:00 (회사 PC Windows 작업 스케줄러)",
    cadence: "weekly",
    cooldownMinutes: 60,
    run: runTeamBriefing,
  },
  {
    id: "contract-completion-snapshot",
    label: "계약 완료 월별 스냅샷",
    description:
      "계약 시트의 '완료' 건수를 현재 월 스냅샷으로 저장합니다. 운영리포트 '계약 체결' 카드가 전월 대비 증감을 이 스냅샷으로 산출합니다. (엑셀은 셀 변경 시각을 남기지 않아 월별 집계로 대체)",
    scheduleInfo: "매일 09:00 권장 (cron-job.org)",
    cadence: "daily",
    cooldownMinutes: 60,
    run: runContractCompletionSnapshot,
  },
  {
    id: "automation-digest",
    label: "자동화 일일 보고",
    description:
      "그날 자동화 잡들의 실행 결과를 모아 Teams 개인 채팅으로 보고합니다.\n실패는 발생 즉시 따로 알림이 가고, 이 보고는 '아예 안 돈 잡'까지 함께 확인하는 용도입니다.",
    scheduleInfo: "매일 11:00 (cron-job.org)",
    cadence: "daily",
    cooldownMinutes: 60,
    run: runAutomationDigest,
  },
  {
    id: "ai-tips-collect",
    label: "AI TIP 후보 수집",
    description:
      "GitHub에서 최근 뜨는 자동화·AI 리포를 수집해 claude로 TIP 초안까지 만들어 후보로 쌓습니다.\nTIP 페이지의 후보 패널에서 확인하고 등록합니다.",
    scheduleInfo: "매주 월 09:00 — 회사 PC Windows 작업 스케줄러 (claude CLI)",
    cadence: "weekly",
    cooldownMinutes: 60,
    localOnly: true,
    run: async () => ({
      ok: false,
      message: "로컬 전용 — 회사 PC 작업 스케줄러가 실행합니다.",
    }),
  },
];

export function getJob(id: string): AutomationJob | undefined {
  return AUTOMATION_JOBS.find((j) => j.id === id);
}
