"use client";

import { useRef, useState } from "react";
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
import { SAVE_FAILED, useSave } from "./use-save";

type Props = {
  kind: ProjectKind;
  entries: ProjectEntryView[];
  reportId: string | null;
  editable: boolean;
  notes: { thisWeek: string; nextWeek: string };
};

type EntryDraft = {
  stage: ProjectStage | null;
  thisWeek: string;
  nextWeek: string;
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
  onSave: (html: string) => void;
  onPasteImage: (dataUrl: string) => Promise<string | null>;
}) {
  const { label, initialHtml, onSave, onPasteImage } = props;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <RichNote
        initialHtml={initialHtml}
        onSave={onSave}
        onPasteImage={onPasteImage}
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 업로드 중에 바뀐 값이 오래된 클로저로 덮이지 않게 최신 값은 ref 에 둔다.
  const latest = useRef<EntryDraft>({
    stage: entry.stage,
    thisWeek: entry.thisWeek,
    nextWeek: entry.nextWeek,
  });
  const save = useSave();

  function persist(patch: Partial<EntryDraft>) {
    latest.current = { ...latest.current, ...patch };
    if (reportId === null) return;
    const payload = latest.current;
    save.run(() =>
      saveProjectEntry({ reportId, projectId: entry.projectId, ...payload }),
    );
  }

  async function uploadImage(dataUrl: string): Promise<string | null> {
    if (reportId === null) return null;
    try {
      const r = await uploadWeeklyImage({ reportId, dataUrl });
      setUploadError(r.ok ? null : r.error);
      return r.ok ? r.url : null;
    } catch {
      setUploadError(SAVE_FAILED);
      return null;
    }
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
                persist({ stage: next });
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
            onPasteImage={uploadImage}
            onSave={(html) => {
              persist({ thisWeek: html });
            }}
          />
          <EditNote
            label="차주"
            initialHtml={entry.nextWeek}
            onPasteImage={uploadImage}
            onSave={(html) => {
              persist({ nextWeek: html });
            }}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyHtml label="금주" html={entry.thisWeek} />
          <ReadOnlyHtml label="차주" html={entry.nextWeek} />
        </div>
      )}
      {(save.error ?? uploadError) ? (
        <p className={ERROR_CLASS}>{save.error ?? uploadError}</p>
      ) : null}
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
