import type { ReactNode } from "react";
import type { AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import type { OpsWeeklyWeekView } from "../_load";
import { AREA_TABS, manageHref, type AreaTab } from "../_params";
import { ApplicationTab } from "./ApplicationTab";
import { AreaNotes } from "./AreaNotes";
import { LeaveTab } from "./LeaveTab";
import { PimsTab } from "./PimsTab";
import { ReportLayout } from "./ReportLayout";
import { WritePanel } from "./WritePanel";

type Props = {
  view: OpsWeeklyWeekView;
  snapshot: AutoSnapshot;
  detail: ReportDetail;
};

type Slots = Record<AreaTab, ReactNode>;

/** 영역 본문 셋 — 지금 page 가 한 탭씩 넘기던 props 그대로다. */
function areasOf({ view, snapshot, detail }: Props, editable: boolean): Slots {
  const props = {
    snapshot,
    detail,
    reportId: view.report?.id ?? null,
    editable,
    freezeNotice: view.freezeNotice,
    // 담당자 이름이 안 맞는 서비스는 관리자가 고칠 일이다 — 비관리자에게는 안내 자체를 안 낸다.
    isAdmin: view.actor.isAdmin,
    settingsHref: manageHref(view.week.week_start, "unmatched"),
  };
  return {
    application: <ApplicationTab {...props} />,
    pims: <PimsTab {...props} />,
    leave: <LeaveTab {...props} />,
  };
}

/** 영역 특이사항 셋 — 쓸 것 패널에 놓인다. */
function notesOf({ view, detail }: Props, editable: boolean): Slots {
  const note = (area: AreaTab) => (
    <AreaNotes
      reportId={view.report?.id ?? null}
      area={area}
      thisWeek={detail.notes[area].thisWeek}
      nextWeek={detail.notes[area].nextWeek}
      editable={editable}
    />
  );
  return Object.fromEntries(AREA_TABS.map((k) => [k, note(k)])) as Slots;
}

/** 내 보고서 — 왼쪽 영역 본문 셋, 오른쪽 쓸 것 패널. snapshot·detail 이 있을 때만 page 가 부른다. */
export function ReportView(props: Props) {
  const editable = props.view.canEdit && props.view.report !== null;
  return (
    <ReportLayout
      checked={props.view.report?.checked_tabs ?? []}
      areas={areasOf(props, editable)}
      panel={<WritePanel notes={notesOf(props, editable)} />}
    />
  );
}
