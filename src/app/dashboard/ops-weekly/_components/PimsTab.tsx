import {
  applyOverrides,
  kept,
  manualCount,
  type AutoSnapshot,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { AreaNotes } from "./AreaNotes";
import { AutoGroupSection } from "./AutoGroupSection";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { SubTabs } from "./SubTabs";
import { TabHeading } from "./TabHeading";
import { UnmatchedNotice } from "./UnmatchedNotice";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice: boolean;
  /** 안 붙은 서비스 안내는 관리자에게만 보인다 */
  isAdmin: boolean;
  /** 설정 탭의 안 붙은 서비스 패널 주소 */
  settingsHref: string;
};

const GROUPS = [
  { key: "thisWeek", title: "금주 발표" },
  { key: "nextWeek", title: "차주 발표" },
] as const;

/** PIMS 탭 — 금주 발표 / 차주 발표를 하위 탭으로 가른다. */
export function PimsTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice,
  isAdmin,
  settingsHref,
}: Props) {
  const unmatched = snapshot.unmatched.pims;
  // 숫자는 KPI 카드와 같은 식(뺀 건 제외 + 직접)이다.
  const tabs = GROUPS.map((g) => ({
    key: g.key,
    label: g.title,
    count:
      kept(snapshot.pims[g.key], detail.overrides) +
      manualCount(detail.manual, "pims", [g.key]),
  }));
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
    <div className="flex flex-col gap-7 p-5 lg:p-7">
      <TabHeading
        title="PIMS"
        summary={`자동 ${snapshot.pims.thisWeek.length + snapshot.pims.nextWeek.length}건 · 직접 ${
          detail.manual.filter((m) => m.area === "pims").length
        }건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
        <UnmatchedNotice
          isAdmin={isAdmin}
          count={unmatched}
          noun="발표 서비스"
          action="발표 서비스 담당자 맞추기를 다시 확인하세요"
          settingsHref={settingsHref}
        />
      </TabHeading>
      <SubTabs tab="pims" ariaLabel="PIMS 묶음" tabs={tabs} panels={panels} />
      <AreaNotes
        reportId={reportId}
        area="pims"
        thisWeek={detail.notes.pims.thisWeek}
        nextWeek={detail.notes.pims.nextWeek}
        editable={editable}
      />
    </div>
  );
}
