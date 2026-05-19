import { Masthead } from "./_components/index/Masthead";
import { Lede } from "./_components/index/Lede";
import { SectionLabel } from "./_components/index/SectionLabel";
import { TriageList } from "./_components/index/TriageList";
import { ProjectGrid } from "./_components/index/ProjectGrid";
import { ShiftTimeline } from "./_components/index/ShiftTimeline";
import { OnCallPanel } from "./_components/index/OnCallPanel";
import { ActivityColumn } from "./_components/index/ActivityColumn";
import { DnCountdown } from "./_components/index/DnCountdown";
import { DomainHeatmap } from "./_components/index/DomainHeatmap";
import {
  dashboardActivities,
  dashboardHeadline,
  dashboardOnCall,
  dashboardProjects,
  dashboardVolume,
  shiftEvents,
  getPatternMockData,
} from "./_data/patterns";
import type { DashWidget } from "./_components/patterns/DashPattern";

/**
 * /dashboard (실시간 현황) — OPSROOM 1면.
 *
 * 신문 1면 메타포: Masthead → Lede → 좌(Triage / Projects / Activity) + 우 rail (Shift / OnCall).
 * 카드 그리드/Inspector 폐기. 입실 직후 5초 안에 우선 행동 + 도메인 진입점이 시야에 들어오게 구성.
 */
// 1차 mock — D-N 카운트다운 (services.write_end_at 임박 4 도메인).
// follow-up: 실 query 연결 (D-N = today vs write_end_at).
const dnItems = [
  { dn: "D-3", university: "건국대학교", service: "정시 1차 접수" },
  { dn: "D-7", university: "서울시립대학교", service: "수시 추합 마감" },
  { dn: "D-14", university: "고려대학교", service: "정시 2차 접수" },
  { dn: "D-30", university: "한양대학교", service: "수시 1차 접수" },
];

// 1차 mock — 12 도메인 × 상태 heatmap.
// follow-up: 도메인별 실 카운트 (services/contracts/incidents/backup/...).
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

export default function DashboardIndexPage() {
  const alerts = getPatternMockData("alerts", "dash") as { widgets: DashWidget[] };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        <Masthead
          now={new Date()}
          shiftLabel="2교대 14:00–22:00 KST"
          volume={dashboardVolume}
        />

        <Lede headline={dashboardHeadline} />

        <div className="flex flex-col gap-8">
          <section>
            <SectionLabel kicker="마감 임박" title="D-N 카운트다운" />
            <DnCountdown items={dnItems} />
          </section>

          <section>
            <SectionLabel kicker="도메인 12" title="상태 Heatmap" />
            <DomainHeatmap rows={heatmapRows} />
          </section>

          <section>
            <SectionLabel kicker="긴급 처리" title="지금 봐야 하는 것" />
            <TriageList widgets={alerts.widgets} max={4} />
          </section>

          <section>
            <SectionLabel kicker="시프트" title="진행도" />
            <ShiftTimeline events={shiftEvents} startHour={14} endHour={22} />
          </section>

          <section>
            <SectionLabel kicker="온콜" title="호출 가능" />
            <OnCallPanel onCall={dashboardOnCall} />
          </section>

          <section>
            <SectionLabel kicker="도메인 12" title="프로젝트 진입점" />
            <ProjectGrid items={dashboardProjects} />
          </section>

          <section>
            <SectionLabel kicker="활동" title="최근 운영 흐름" />
            <ActivityColumn items={dashboardActivities} />
          </section>
        </div>
      </div>
    </div>
  );
}
