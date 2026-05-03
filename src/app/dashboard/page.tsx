import { Masthead } from "./_components/index/Masthead";
import { Lede } from "./_components/index/Lede";
import { SectionLabel } from "./_components/index/SectionLabel";
import { TriageList } from "./_components/index/TriageList";
import { ProjectGrid } from "./_components/index/ProjectGrid";
import { ShiftTimeline } from "./_components/index/ShiftTimeline";
import { OnCallPanel } from "./_components/index/OnCallPanel";
import { ActivityColumn } from "./_components/index/ActivityColumn";
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
export default function DashboardIndexPage() {
  const alerts = getPatternMockData("alerts", "dash") as { widgets: DashWidget[] };

  return (
    <div className="h-full overflow-y-auto bg-washi">
      <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        <Masthead
          now={new Date()}
          shiftLabel="2교대 14:00–22:00 KST"
          volume={dashboardVolume}
        />

        <Lede headline={dashboardHeadline} />

        <div className="flex flex-col gap-8">
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
