import type { AutoItem } from "@/features/ops-weekly/auto-lists/application";
import { applyOverrides, type AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { AreaNotes } from "./AreaNotes";
import { AutoGroupSection } from "./AutoGroupSection";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { TabHeading } from "./TabHeading";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice: boolean;
};

const GROUPS = [
  { key: "thisWeek", title: "금주 발표" },
  { key: "nextWeek", title: "차주 발표" },
] as const;

/** PIMS 탭 — 금주 발표 / 차주 발표. */
export function PimsTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice,
}: Props) {
  const unmatched = snapshot.unmatched.pims;
  const view = (list: AutoItem[]) => applyOverrides(list, detail.overrides);
  return (
    <div className="flex flex-col gap-7 p-5 lg:p-7">
      <TabHeading
        title="PIMS"
        summary={`자동 ${snapshot.pims.thisWeek.length + snapshot.pims.nextWeek.length}건 · 직접 ${
          detail.manual.filter((m) => m.area === "pims").length
        }건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
        <p className="text-sm text-muted">
          {`담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 ${unmatched}건${
            unmatched > 0
              ? " — 발표 서비스 담당자 맞추기를 다시 확인하세요"
              : ""
          }`}
        </p>
      </TabHeading>
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <AutoGroupSection
            key={g.key}
            title={g.title}
            items={view(snapshot.pims[g.key])}
            manual={detail.manual}
            reportId={reportId}
            area="pims"
            groupKey={g.key}
            editable={editable}
            emptyText="해당하는 발표가 없습니다"
          />
        ))}
      </div>
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
