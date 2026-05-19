import { HudShell } from "./_components/hud/HudShell";
import { LeftMePanel } from "./_components/hud/LeftMePanel";
import { RightSystemPanel } from "./_components/hud/RightSystemPanel";
import { EventTicker } from "./_components/hud/EventTicker";
import { DnCountdown } from "./_components/index/DnCountdown";
import { DomainHeatmap } from "./_components/index/DomainHeatmap";

/**
 * /dashboard — 운영부 콕핏 (HUD) 1면.
 *
 * 3 zone:
 * - 좌 (나):    본인 KPI 4종 (todo / services / handover / receivables) + 내 활동
 * - 중 (운영부): D-N 카운트다운 + 12 도메인 Heatmap
 * - 우 (시스템): 시프트 / 온콜 / 트래픽 / 빌드·배포 / 세션 / SLA / 알림
 *
 * 하단: EventTicker (운영부 라이브 이벤트 스트립).
 *
 * 1차 PR — mock data 인라인. follow-up: 실 query 연결.
 */

const meStats = {
  todoTodayCount: 4,
  todoWeekCount: 12,
  servicesMineCount: 5,
  handoverInProgressCount: 1,
  receivablesPendingCount: 2,
  myActivities: [
    { ts: "14:23", who: "송영석", act: "계약 승인 (한양대)" },
    { ts: "14:10", who: "송영석", act: "#INC-042 신규 등록" },
    { ts: "13:42", who: "송영석", act: "백업 요청 검토" },
    { ts: "13:05", who: "송영석", act: "인수인계 발송 (이화)" },
    { ts: "11:30", who: "송영석", act: "서비스 운영자 변경" },
  ],
};

const dnItems = [
  { dn: "D-3", university: "건국대학교", service: "정시 1차 접수" },
  { dn: "D-7", university: "서울시립대학교", service: "수시 추합 마감" },
  { dn: "D-14", university: "고려대학교", service: "정시 2차 접수" },
  { dn: "D-30", university: "한양대학교", service: "수시 1차 접수" },
];

const heatmapRows = [
  { domain: "서비스", pending: 3, inProgress: 7, done: 12 },
  { domain: "계약", pending: 1, inProgress: 4, done: 8 },
  { domain: "결제", pending: 5, inProgress: 0, done: 2 },
  { domain: "사고", pending: 0, inProgress: 2, done: 5 },
  { domain: "백업 요청", pending: 2, inProgress: 1, done: 6 },
  { domain: "인수인계", pending: 0, inProgress: 3, done: 9 },
  { domain: "온보딩", pending: 1, inProgress: 0, done: 4 },
  { domain: "데이터 요청", pending: 4, inProgress: 2, done: 1 },
  { domain: "미수채권", pending: 6, inProgress: 0, done: 3 },
  { domain: "전형료 정산", pending: 0, inProgress: 1, done: 7 },
  { domain: "PIMS", pending: 2, inProgress: 5, done: 0 },
  { domain: "K12", pending: 0, inProgress: 0, done: 1 },
];

const systemStats = {
  shiftLabel: "2교대 14:00–22:00 KST",
  shiftProgressPct: 30,
  onCallName: "한효진",
  trafficLevel: 3 as const,
  buildOk: true,
  deployOk: true,
  activeSessions: 8,
  slaPct: 99.7,
  alertCount: 3,
};

const tickerEvents = [
  { id: "t1", label: "결제 350ms" },
  { id: "t2", label: "D-3 건국대" },
  { id: "t3", label: "#INC-042 처리완료" },
  { id: "t4", label: "김유민 알림 47건" },
  { id: "t5", label: "백업 ✓" },
];

export default function DashboardIndexPage() {
  const now = new Date();
  const kst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return (
    <HudShell
      header={
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="flex items-baseline gap-2">
            <span className="font-mono text-2xs uppercase tracking-[0.22em] text-vermilion">
              OPSROOM
            </span>
            <span className="text-md font-semibold tracking-[-0.01em] text-ink">
              실시간 현황 HUD
            </span>
          </h1>
          <p className="font-mono text-xs text-ink-soft">
            {kst} KST · 송영석 온듀티
          </p>
        </div>
      }
      left={<LeftMePanel stats={meStats} />}
      center={
        <div className="space-y-6">
          <section>
            <ZoneLabel kicker="마감 임박" title="D-N 카운트다운" />
            <DnCountdown items={dnItems} />
          </section>
          <section>
            <ZoneLabel kicker="도메인 12" title="상태 Heatmap" />
            <DomainHeatmap rows={heatmapRows} />
          </section>
        </div>
      }
      right={<RightSystemPanel stats={systemStats} />}
      ticker={<EventTicker events={tickerEvents} />}
    />
  );
}

function ZoneLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 border-b border-line-soft pb-1.5">
      <span className="font-mono text-2xs uppercase tracking-[0.22em] text-vermilion">
        {kicker}
      </span>
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
    </div>
  );
}
