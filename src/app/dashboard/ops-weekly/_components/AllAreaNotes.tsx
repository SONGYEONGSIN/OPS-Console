"use client";

import type { AreaNoteByWriter } from "@/features/ops-weekly/all-view";

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <p className="whitespace-pre-wrap text-sm text-ink [overflow-wrap:anywhere]">
        {text || "—"}
      </p>
    </div>
  );
}

/** 전체 보고의 쓸 것 패널 자리 — 그 영역에 특이사항을 쓴 사람만, 읽기 전용. */
export function AllAreaNotes(props: {
  title: string;
  notes: readonly AreaNoteByWriter[];
}) {
  const { title, notes } = props;
  return (
    <section
      aria-label={`${title} 특이사항`}
      className="flex flex-col gap-3"
    >
      <h3 className="border-b border-line pb-2 text-sm font-bold text-ink">
        {`${title} 특이사항`}
      </h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted">작성한 특이사항이 없습니다</p>
      ) : (
        notes.map((n) => (
          <article
            key={n.name}
            className="flex flex-col gap-2 border-b border-line-soft pb-3"
          >
            <span className="text-sm font-bold text-ink">{n.name}</span>
            <Note label="금주" text={n.thisWeek} />
            <Note label="차주" text={n.nextWeek} />
          </article>
        ))
      )}
    </section>
  );
}
