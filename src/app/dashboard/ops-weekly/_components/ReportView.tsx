import type { ReactNode } from "react";
import type { ProjectKind } from "@/features/ops-weekly/constants";
import type { AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import type { OpsWeeklyWeekView } from "../_load";
import { appSubStateOf, directAddGroups } from "../_groups";
import { AREA_TABS, manageHref, type AreaTab } from "../_params";
import { ApplicationTab } from "./ApplicationTab";
import { AreaNotes } from "./AreaNotes";
import { DirectAddPanel } from "./DirectAddPanel";
import { LeaveTab } from "./LeaveTab";
import { PimsTab } from "./PimsTab";
import { ProjectDrawer } from "./ProjectDrawer";
import { ProjectDrawerProvider } from "./project-drawer-context";
import { ProjectSummaryCards } from "./ProjectSummaryCards";
import { ProjectTab } from "./ProjectTab";
import { ReportLayout } from "./ReportLayout";
import { SubmitBar } from "./SubmitBar";
import { WritePanel } from "./WritePanel";

type Props = {
  view: OpsWeeklyWeekView;
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  /** 남의 보고서를 보는 중이면 그 사람 이메일, 본인 보고서면 null. 제출은 본인 것에만 있다. */
  op: string | null;
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

/** 직접 추가 셋 — 영역마다 하나, 셋 다 마운트한다. 쓸 수 없는 보고서(보고서 없음·읽기 전용)면 null. */
function directAddOf({ view, snapshot }: Props, editable: boolean): Slots | null {
  const reportId = view.report?.id;
  if (!editable || !reportId) return null;
  const appSubState = appSubStateOf(snapshot.application);
  const panel = (area: AreaTab) => (
    <DirectAddPanel
      area={area}
      reportId={reportId}
      groups={directAddGroups(area, appSubState.collected)}
      appSubState={appSubState}
    />
  );
  return Object.fromEntries(AREA_TABS.map((k) => [k, panel(k)])) as Slots;
}

/** 서랍 안 프로젝트·TF — 제목은 서랍 머리가 그린다(hideHeading). */
function drawerPanelsOf(
  { view, detail }: Props,
  editable: boolean,
): Record<ProjectKind, ReactNode> {
  const panel = (kind: ProjectKind) => (
    <ProjectTab
      kind={kind}
      hideHeading
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
  return { project: panel("project"), tf: panel("tf") };
}

/** 내 보고서 — 왼쪽 영역 본문 셋, 오른쪽 쓸 것 패널, 프로젝트·TF 서랍. snapshot·detail 이 있을 때만 page 가 부른다. */
export function ReportView(props: Props) {
  const { view, detail, op } = props;
  const editable = view.canEdit && view.report !== null;
  const checked = view.report?.checked_tabs ?? [];
  return (
    <ProjectDrawerProvider>
      <ReportLayout
        checked={checked}
        areas={areasOf(props, editable)}
        panel={
          <WritePanel
            notes={notesOf(props, editable)}
            directAdd={directAddOf(props, editable)}
            submit={
              op === null ? (
                <SubmitBar
                  reportId={view.report?.id ?? null}
                  canSubmit={view.canSubmit}
                />
              ) : null
            }
            projects={
              <ProjectSummaryCards
                entries={detail.projects}
                checked={checked}
                editable={editable}
              />
            }
          />
        }
      />
      <ProjectDrawer panels={drawerPanelsOf(props, editable)} />
    </ProjectDrawerProvider>
  );
}
