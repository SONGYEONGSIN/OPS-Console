"use client";

import { useState } from "react";
import { RichNote } from "@/app/r/checklist/[token]/_components/RichNote";
import {
  saveProjectEntry,
  uploadWeeklyImage,
} from "@/features/ops-weekly/actions";
import {
  PROJECT_STAGES,
  type ProjectKind,
  type ProjectStage,
} from "@/features/ops-weekly/constants";
import type { ProjectEntryView } from "@/features/ops-weekly/merge";
import { AreaNotes } from "./AreaNotes";
import { ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  kind: ProjectKind;
  entries: ProjectEntryView[];
  reportId: string | null;
  editable: boolean;
  notes: { thisWeek: string; nextWeek: string };
};

const NO_STAGE = "단계 미선택";

function isStage(v: string): v is ProjectStage {
  return (PROJECT_STAGES as readonly string[]).includes(v);
}

function ReadOnlyHtml({ label, html }: { label: string; html: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {html === "" ? (
        <p className="text-sm text-ink">—</p>
      ) : (
        // 서버(toStoredNoteHtml)에서 정화되고 _load 가 서명한 HTML 만 들어온다.
        <div
          className="text-sm text-ink [&_img]:my-1 [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function EditNote(props: {
  label: string;
  initialHtml: string;
  reportId: string;
  onSave: (html: string) => void;
}) {
  const { label, initialHtml, reportId, onSave } = props;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <RichNote
        initialHtml={initialHtml}
        onSave={onSave}
        onPasteImage={(dataUrl) =>
          uploadWeeklyImage({ reportId, dataUrl }).then((r) =>
            r.ok ? r.url : null,
          )
        }
      />
    </div>
  );
}

function EntryCard(props: {
  entry: ProjectEntryView;
  reportId: string | null;
  editable: boolean;
}) {
  const { entry, reportId, editable } = props;
  const [stage, setStage] = useState<ProjectStage | null>(entry.stage);
  const [thisWeek, setThis] = useState(entry.thisWeek);
  const [nextWeek, setNext] = useState(entry.nextWeek);
  const save = useSave();

  function persist(next: {
    stage: ProjectStage | null;
    thisWeek: string;
    nextWeek: string;
  }) {
    if (reportId === null) return;
    save.run(() =>
      saveProjectEntry({
        reportId,
        projectId: entry.projectId,
        ...next,
      }),
    );
  }

  return (
    <article className="flex flex-col gap-3 border border-line-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">{entry.projectName}</h3>
        {editable && reportId !== null ? (
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            진행 단계
            <select
              value={stage ?? ""}
              onChange={(e) => {
                const next = isStage(e.target.value) ? e.target.value : null;
                setStage(next);
                persist({ stage: next, thisWeek, nextWeek });
              }}
              className={FIELD_CLASS}
            >
              <option value="">{NO_STAGE}</option>
              {PROJECT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-muted">{entry.stage ?? "—"}</span>
        )}
      </div>
      {editable && reportId !== null ? (
        <div className="grid gap-3 md:grid-cols-2">
          <EditNote
            label="금주"
            initialHtml={entry.thisWeek}
            reportId={reportId}
            onSave={(html) => {
              setThis(html);
              persist({ stage, thisWeek: html, nextWeek });
            }}
          />
          <EditNote
            label="차주"
            initialHtml={entry.nextWeek}
            reportId={reportId}
            onSave={(html) => {
              setNext(html);
              persist({ stage, thisWeek, nextWeek: html });
            }}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyHtml label="금주" html={entry.thisWeek} />
          <ReadOnlyHtml label="차주" html={entry.nextWeek} />
        </div>
      )}
      {save.error ? <p className={ERROR_CLASS}>{save.error}</p> : null}
    </article>
  );
}

export function ProjectTab(props: Props) {
  const { kind, entries, reportId, editable, notes } = props;
  const mine = entries
    .filter((e) => e.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const emptyText =
    kind === "tf" ? "맡은 TF가 없습니다" : "맡은 프로젝트가 없습니다";
  return (
    <section data-tab={kind} className="flex flex-col gap-4 p-5 lg:p-7">
      {mine.length === 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-ink">{emptyText}</p>
          <p className="text-xs text-muted">
            관리자 설정에서 담당자를 지정합니다
          </p>
        </div>
      ) : (
        mine.map((e) => (
          <EntryCard
            key={e.projectId}
            entry={e}
            reportId={reportId}
            editable={editable}
          />
        ))
      )}
      <AreaNotes
        reportId={reportId}
        area={kind === "tf" ? "tf" : "project"}
        thisWeek={notes.thisWeek}
        nextWeek={notes.nextWeek}
        editable={editable}
      />
    </section>
  );
}
