"use client";

import Link from "next/link";
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
import { usePendingSaves } from "./pending-saves";
import { SaveStatus } from "./SaveStatus";
import { TabHeading } from "./TabHeading";
import { ERROR_CLASS, FIELD_CLASS } from "./styles";
import { SAVE_FAILED, useSave } from "./use-save";

type Props = {
  kind: ProjectKind;
  entries: ProjectEntryView[];
  reportId: string | null;
  editable: boolean;
  notes: { thisWeek: string; nextWeek: string };
  /** 관리자에게만 준다 — 빈 상태 안내에 설정 링크를 붙인다 */
  settingsHref?: string;
  /** 서랍 머리가 그 영역의 제목이다 — true 면 자체 제목(+건수)을 그리지 않는다 */
  hideHeading?: boolean;
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

export function ReadOnlyHtml({ label, html }: { label: string; html: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {html === "" ? (
        <p className="text-sm text-ink">—</p>
      ) : (
        // 서버(toStoredNoteHtml)에서 정화되고 _load 가 서명한 HTML 만 들어온다.
        // 일회성: 공백 없는 긴 URL 은 어디서든 줄바꿈(anywhere 는 min-content 도 줄인다),
        // 붙여넣은 표는 칸을 넘지 않고 가로 스크롤 — 토큰·break-words 로는 못 한다.
        <div
          className="overflow-x-auto text-sm text-ink [overflow-wrap:anywhere] [&_img]:my-1 [&_img]:max-w-full"
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
    <div className="flex min-w-0 flex-col gap-1">
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
  const registry = usePendingSaves();
  const save = useSave({
    track: {
      key: `project:${reportId ?? ""}:${entry.projectId}`,
      label: `${entry.projectName} 내용`,
    },
  });

  function persist(patch: Partial<EntryDraft>) {
    latest.current = { ...latest.current, ...patch };
    if (reportId === null) return;
    const payload = latest.current;
    save.run(() =>
      saveProjectEntry({ reportId, projectId: entry.projectId, ...payload }),
    );
  }

  async function doUpload(
    id: string,
    dataUrl: string,
  ): Promise<{ url: string | null; error: string | null }> {
    try {
      const r = await uploadWeeklyImage({ reportId: id, dataUrl });
      return r.ok ? { url: r.url, error: null } : { url: null, error: r.error };
    } catch {
      return { url: null, error: SAVE_FAILED };
    }
  }

  // 업로드도 저장의 일부다 — 끝난 뒤에 이어지는 저장 전에 제출이 앞지르지 못하게 등록한다.
  async function uploadImage(dataUrl: string): Promise<string | null> {
    if (reportId === null) return null;
    const work = doUpload(reportId, dataUrl);
    registry?.track(
      `upload:${reportId}:${entry.projectId}`,
      `${entry.projectName} 이미지 업로드`,
      // 기다리게만 한다 — 업로드가 실패하면 저장 안 된 내용이 없으므로 실패로 기록하지 않는다.
      work.then(() => null),
    );
    const r = await work;
    setUploadError(r.error);
    return r.url;
  }

  return (
    <article className="flex flex-col gap-3 border border-line-soft bg-situation-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">{entry.projectName}</h3>
        {editable && reportId !== null ? (
          <div className="flex flex-wrap items-center gap-3">
            <SaveStatus
              pending={save.pending}
              error={save.error}
              savedAt={save.savedAt}
            />
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
          </div>
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
        <p role="alert" className={ERROR_CLASS}>
          {save.error ?? uploadError}
        </p>
      ) : null}
    </article>
  );
}

export function ProjectTab(props: Props) {
  const {
    kind,
    entries,
    reportId,
    editable,
    notes,
    settingsHref,
    hideHeading,
  } = props;
  const mine = entries
    .filter((e) => e.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const emptyText =
    kind === "tf" ? "맡은 TF가 없습니다" : "맡은 프로젝트가 없습니다";
  return (
    <section data-tab={kind} className="flex flex-col gap-7">
      {hideHeading ? null : (
        <TabHeading
          title={kind === "tf" ? "TF" : "프로젝트"}
          summary={`${mine.length}건`}
        />
      )}
      {mine.length === 0 ? (
        <div className="flex flex-col gap-1 border border-line-soft bg-situation-bg px-4 py-6 text-sm">
          <p className="text-ink">{emptyText}</p>
          <p className="text-xs text-muted">
            관리자 설정에서 담당자를 지정합니다
          </p>
          {settingsHref ? (
            <Link href={settingsHref} className="text-xs underline">
              설정 열기
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mine.map((e) => (
            <EntryCard
              key={e.projectId}
              entry={e}
              reportId={reportId}
              editable={editable}
            />
          ))}
        </div>
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
