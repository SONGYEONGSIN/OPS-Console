"use client";

import { blocksToPdfModel, type PdfRun } from "@/features/meetings/pdf-model";

function Runs({ runs }: { runs: PdfRun[] }) {
  return (
    <>
      {runs.map((r, i) => (
        <span
          key={i}
          className={`${r.bold ? "font-semibold" : ""} ${r.italic ? "italic" : ""}`}
        >
          {r.text}
        </span>
      ))}
    </>
  );
}

/**
 * 회의록 문서 미리보기 — 편집 워크스페이스 좌측의 "실제 문서" 화면.
 * 우측 에디터 내용(content)을 실시간으로 받아 정식 문서 형태로 렌더한다.
 */
export function MeetingDocument({
  title,
  typeLabel,
  dateDisplay,
  location,
  attendees,
  content,
}: {
  title: string;
  typeLabel: string;
  dateDisplay: string;
  location: string;
  attendees: string[];
  content: unknown[];
}) {
  const nodes = blocksToPdfModel(
    (content ?? []) as Parameters<typeof blocksToPdfModel>[0],
  );

  return (
    <article className="mx-auto max-w-[760px] border border-line-soft bg-situation-bg px-10 py-12 [box-shadow:3px_4px_0_rgba(21,18,12,0.08)]">
      <header className="mb-6 border-b border-ink pb-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-vermilion">
          {typeLabel} 회의록
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          {title || "제목 없음"}
        </h1>
      </header>

      <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-ink-soft">
        <dt className="text-muted">일시</dt>
        <dd>{dateDisplay || "-"}</dd>
        <dt className="text-muted">장소</dt>
        <dd>{location || "-"}</dd>
        <dt className="text-muted">참석자</dt>
        <dd>{attendees.length > 0 ? attendees.join(", ") : "-"}</dd>
      </dl>

      <div className="space-y-2">
        {nodes.length === 0 ? (
          <p className="text-sm text-muted">작성된 내용이 없습니다.</p>
        ) : (
          nodes.map((n, i) => {
            switch (n.kind) {
              case "heading":
                return (
                  <h2
                    key={i}
                    className="pt-3 text-base font-bold text-ink first:pt-0"
                  >
                    <Runs runs={n.runs} />
                  </h2>
                );
              case "bullet":
                return (
                  <p key={i} className="flex gap-2 pl-3 text-sm text-ink-soft">
                    <span className="text-muted">•</span>
                    <span>
                      <Runs runs={n.runs} />
                    </span>
                  </p>
                );
              case "numbered":
                return (
                  <p key={i} className="flex gap-2 pl-3 text-sm text-ink-soft">
                    <span className="text-muted">{i + 1}.</span>
                    <span>
                      <Runs runs={n.runs} />
                    </span>
                  </p>
                );
              case "check":
                return (
                  <p key={i} className="flex gap-2 pl-3 text-sm text-ink-soft">
                    <span>{n.checked ? "☑" : "☐"}</span>
                    <span className={n.checked ? "text-muted line-through" : ""}>
                      <Runs runs={n.runs} />
                    </span>
                  </p>
                );
              default:
                return (
                  <p key={i} className="text-sm leading-relaxed text-ink-soft">
                    <Runs runs={n.runs} />
                  </p>
                );
            }
          })
        )}
      </div>
    </article>
  );
}
