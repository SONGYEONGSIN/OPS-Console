import {
  applyOverrides,
  kept,
  manualCount,
  type AutoSnapshot,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { PIMS_GROUP_TITLE } from "../_groups";
import { AREA_TAB_LABEL } from "../_params";
import { AutoGroupSection } from "./AutoGroupSection";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { SubTabs } from "./SubTabs";
import { TabHeading } from "./TabHeading";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice: boolean;
  /** 안 붙은 서비스 안내는 관리자에게만 보인다 */
  /** 설정 탭의 안 붙은 서비스 패널 주소 */
};

const GROUPS = [
  { key: "thisWeek", title: PIMS_GROUP_TITLE.thisWeek },
  { key: "nextWeek", title: PIMS_GROUP_TITLE.nextWeek },
] as const;

/** PIMS 탭 — 금주 발표 / 차주 발표를 하위 탭으로 가른다. */
export function PimsTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice,
}: Props) {
  // 숫자는 KPI 카드와 같은 식(뺀 건 제외 + 직접)이다.
  const tabs = GROUPS.map((g) => ({
    key: g.key,
    label: g.title,
    count:
      kept(snapshot.pims[g.key], detail.overrides) +
      manualCount(detail.manual, "pims", [g.key]),
  }));
  const autoCount = GROUPS.reduce(
    (n, g) => n + kept(snapshot.pims[g.key], detail.overrides),
    0,
  );
  const panels = Object.fromEntries(
    GROUPS.map((g) => [
      g.key,
      <AutoGroupSection
        key={g.key}
        title={g.title}
        items={applyOverrides(snapshot.pims[g.key], detail.overrides)}
        manual={detail.manual}
        reportId={reportId}
        area="pims"
        groupKey={g.key}
        editable={editable}
        emptyText="해당하는 발표가 없습니다"
      />,
    ]),
  );
  return (
    <div className="flex flex-col gap-7">
      <TabHeading
        title={AREA_TAB_LABEL.pims}
        summary={`자동 ${autoCount}건 · 직접 ${
          detail.manual.filter((m) => m.area === "pims").length
        }건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
      </TabHeading>
      <SubTabs tab="pims" ariaLabel={`${AREA_TAB_LABEL.pims} 묶음`} tabs={tabs} panels={panels} />
    </div>
  );
}
