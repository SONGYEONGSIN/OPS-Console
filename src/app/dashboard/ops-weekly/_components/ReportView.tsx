import type { ReactNode } from "react";
import type { ProjectKind } from "@/features/ops-weekly/constants";
import type { AllReportsView } from "@/features/ops-weekly/all-view";
import {
  groupEntriesByProject,
  type AutoSnapshot,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import type { OpsWeeklyWeekView } from "../_load";
import { appSubStateOf, directAddGroups } from "../_groups";
import { shownProjectKinds } from "../_project-kinds";
import {
  AREA_TAB_LABEL,
  PANEL_AREAS,
  manageHref,
  type AreaTab,
  type PanelArea,
} from "../_params";
import { AllAreaNotes } from "./AllAreaNotes";
import { ApplicationTab } from "./ApplicationTab";
import { AreaNotes } from "./AreaNotes";
import { DirectAddPanel } from "./DirectAddPanel";
import { LeaveTab } from "./LeaveTab";
import { PimsTab } from "./PimsTab";
import { ProjectOverview } from "./ProjectOverview";
import { ProjectTab } from "./ProjectTab";
import { ReportLayout } from "./ReportLayout";
import { SubmitTab } from "./SubmitTab";
import { WritePanel } from "./WritePanel";

type Props = {
  view: OpsWeeklyWeekView;
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  /** 남의 보고서를 보는 중이면 그 사람 이름과 제출 현황 주소 — 제목을 달고 제출은 없다. 본인 보고서면 null */
  viewingOther: { name: string; backHref: string } | null;
};

type Slots = Record<AreaTab, ReactNode>;
type PanelSlots = Record<PanelArea, ReactNode>;

const panelSlots = (make: (area: PanelArea) => ReactNode): PanelSlots =>
  Object.fromEntries(PANEL_AREAS.map((k) => [k, make(k)])) as PanelSlots;

/** 영역 본문 넷 — 프로젝트·TF 탭은 프로젝트 절과 TF 절을 위아래로(각자 특이사항). */
function areasOf(props: Props, editable: boolean): Slots {
  const { view, snapshot, detail } = props;
  const tabProps = {
    snapshot,
    detail,
    reportId: view.report?.id ?? null,
    editable,
    freezeNotice: view.freezeNotice,
  };
  return {
    application: <ApplicationTab {...tabProps} />,
    pims: <PimsTab {...tabProps} />,
    project: projectsOf(props, editable),
    leave: <LeaveTab {...tabProps} />,
  };
}

/** 영역 특이사항 셋 — 쓸 것 칸에 놓인다. */
function notesOf({ view, detail }: Props, editable: boolean): PanelSlots {
  return panelSlots((area) => (
    <AreaNotes
      reportId={view.report?.id ?? null}
      area={area}
      thisWeek={detail.notes[area].thisWeek}
      nextWeek={detail.notes[area].nextWeek}
      editable={editable}
    />
  ));
}

/** 제출 탭 — 본인 보고서(남의 보고서·전체 보고 아님)에서만. 요약을 보고 여기서 제출한다. */
function submitOf(props: Props): ReactNode {
  const { view, snapshot, detail, viewingOther } = props;
  const report = view.report;
  if (report === null || viewingOther !== null) return null;
  return (
    <SubmitTab
      snapshot={snapshot}
      detail={detail}
      reportId={report.id}
      canSubmit={view.canSubmit}
      status={report.status}
      submittedAt={report.submitted_at}
    />
  );
}

/** 직접 추가 셋 — 영역마다 하나, 셋 다 마운트한다. 쓸 수 없는 보고서(보고서 없음·읽기 전용)면 null. */
function directAddOf(
  { view, snapshot }: Props,
  editable: boolean,
): PanelSlots | null {
  const reportId = view.report?.id;
  if (!editable || !reportId) return null;
  const appSubState = appSubStateOf(snapshot.application);
  return panelSlots((area) => (
    <DirectAddPanel
      area={area}
      reportId={reportId}
      groups={directAddGroups(area, appSubState.collected)}
      appSubState={appSubState}
    />
  ));
}

/** 프로젝트·TF 탭 본문 — 프로젝트 절 위, TF 절 아래(TF 는 TF 담당자에게만). */
function projectsOf({ view, detail }: Props, editable: boolean): ReactNode {
  const panel = (kind: ProjectKind) => (
    <ProjectTab
      key={kind}
      kind={kind}
      entries={detail.projects}
      reportId={view.report?.id ?? null}
      editable={editable}
      notes={detail.notes[kind]}
      settingsHref={
        view.actor.isAdmin
          ? manageHref(view.week.week_start, "projects")
          : undefined
      }
    />
  );
  return (
    <div className="flex flex-col gap-10">
      {shownProjectKinds(detail).map(panel)}
    </div>
  );
}

/**
 * 전체 보고 — 볼 것은 같은 영역 본문(담당자가 실린 합친 목록, 읽기 전용), 프로젝트·TF 탭은 모아보기,
 * 쓸 것 칸 자리에 사람별 특이사항. 직접 추가·제출은 없다(누구의 보고서도 아니다).
 */
function AllReportsBody(props: Props & { all: AllReportsView }) {
  const { all, detail } = props;
  const notes = panelSlots((k) => (
    <AllAreaNotes key={k} title={AREA_TAB_LABEL[k]} notes={all.notes[k]} />
  ));
  return (
    <ReportLayout
      areas={{
        ...areasOf(props, false),
        project: (
          <ProjectOverview groups={groupEntriesByProject(detail.projects)} />
        ),
      }}
      panel={<WritePanel notes={notes} directAdd={null} />}
    />
  );
}

/** 내 보고서 — 영역 본문 넷 + 제출 탭, [특이사항] 으로 여는 쓸 것 칸. snapshot·detail 이 있을 때만 page 가 부른다. */
export function ReportView(props: Props) {
  const { view } = props;
  if (view.all !== null) return <AllReportsBody {...props} all={view.all} />;
  const editable = view.canEdit && view.report !== null;
  return (
    <ReportLayout
      heading={props.viewingOther}
      areas={areasOf(props, editable)}
      submit={submitOf(props)}
      panel={
        <WritePanel
          notes={notesOf(props, editable)}
          directAdd={directAddOf(props, editable)}
        />
      }
    />
  );
}
