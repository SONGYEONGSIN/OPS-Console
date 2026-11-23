"use client";

import type { ReactNode } from "react";
import {
  PROJECT_KINDS,
  type ReportStatus,
} from "@/features/ops-weekly/constants";
import type { AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { areaCounts, countLabel } from "../_area-counts";
import { formatMdHm } from "../_format";
import {
  AREA_TAB_LABEL,
  AREA_TAB_TITLE,
  PANEL_AREAS,
  type AreaTab,
} from "../_params";
import { ReadOnlyHtml } from "./ProjectTab";
import { SubmitBar } from "./SubmitBar";
import { TabHeading } from "./TabHeading";
import { useOpsArea } from "./use-ops-area";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string;
  canSubmit: boolean;
  status: ReportStatus;
  submittedAt: string | null;
};

const EMPTY_NOTE = "없음";

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {text === "" ? (
        <p className="text-sm text-muted">{EMPTY_NOTE}</p>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-ink [overflow-wrap:anywhere]">
          {text}
        </p>
      )}
    </div>
  );
}

/** 영역 한 묶음 — 머리를 누르면 그 탭으로 간다(고치러 가는 길). */
function Block(props: { area: AreaTab; meta?: string; children: ReactNode }) {
  const { setArea } = useOpsArea();
  const title = AREA_TAB_TITLE[props.area];
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-t border-line pt-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <button
          type="button"
          aria-label={`${title}로 가기`}
          className="text-base font-bold text-ink underline-offset-4 hover:text-vermilion hover:underline"
          onClick={() => {
            setArea(props.area);
          }}
        >
          {title}
        </button>
        {props.meta ? (
          <span className="text-sm tabular-nums text-muted">{props.meta}</span>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

function NotesGrid({
  thisWeek,
  nextWeek,
}: {
  thisWeek: string;
  nextWeek: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Note label="금주 특이사항" text={thisWeek} />
      <Note label="차주 특이사항" text={nextWeek} />
    </div>
  );
}

function ProjectsBlock({ detail }: { detail: ReportDetail }) {
  return (
    <Block area="project">
      {PROJECT_KINDS.map((kind) => {
        const mine = detail.projects
          .filter((e) => e.kind === kind)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div key={kind} className="flex flex-col gap-3">
            <h4 className="text-sm font-bold text-ink">
              {AREA_TAB_LABEL[kind]}
            </h4>
            {mine.length === 0 ? (
              <p className="text-sm text-muted">
                {kind === "tf"
                  ? "맡은 TF가 없습니다"
                  : "맡은 프로젝트가 없습니다"}
              </p>
            ) : (
              mine.map((e) => (
                <div key={e.projectId} className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-ink">
                    {`${e.projectName} · ${e.stage ?? "단계 미선택"}`}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ReadOnlyHtml label="금주" html={e.thisWeek} />
                    <ReadOnlyHtml label="차주" html={e.nextWeek} />
                  </div>
                </div>
              ))
            )}
            <NotesGrid {...detail.notes[kind]} />
          </div>
        );
      })}
    </Block>
  );
}

/**
 * 제출 탭 — 영역 탭에서 보고 쓴 것을 한눈에 다시 보고 여기서 제출한다(제출 자리는 이 한 곳).
 * 요약은 서버가 준 detail 로 그린다 — 특이사항 저장이 경로를 다시 그려 탭을 옮겨 오면 최신이고,
 * 저장이 아직 나가는 중이면 useSubmit 이 끝날 때까지 기다린다.
 */
export function SubmitTab(props: Props) {
  const { snapshot, detail } = props;
  const counts = areaCounts(snapshot, detail);
  const block = (area: (typeof PANEL_AREAS)[number]) => (
    <Block key={area} area={area} meta={countLabel(counts[area])}>
      <NotesGrid {...detail.notes[area]} />
    </Block>
  );
  return (
    <section data-tab="submit" className="flex flex-col gap-7">
      <TabHeading title="제출" summary="내용을 확인하고 제출하세요" />
      {block("application")}
      {block("pims")}
      <ProjectsBlock detail={detail} />
      {block("leave")}
      <div className="flex flex-col items-end gap-1 border-t border-line pt-5">
        {props.status === "submitted" ? (
          <p className="text-sm tabular-nums text-ink-soft">
            {props.submittedAt
              ? `제출함 ${formatMdHm(props.submittedAt)}`
              : "제출함"}
          </p>
        ) : null}
        <SubmitBar reportId={props.reportId} canSubmit={props.canSubmit} />
      </div>
    </section>
  );
}
