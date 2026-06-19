"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import {
  blocksToPdfModel,
  type PdfNode,
  type PdfRun,
} from "@/features/meetings/pdf-model";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  type MeetingType,
  type MeetingStatus,
} from "@/features/meetings/schemas";

function Runs({ runs }: { runs: PdfRun[] }) {
  if (runs.length === 0) return null;
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

/** PdfNode[] → 읽기용 JSX (회의내용 미리보기 / 회의문서 본문 공용). */
function DocBody({ nodes }: { nodes: PdfNode[] }) {
  const meaningful = nodes.filter(
    (n) => n.runs.some((r) => r.text.trim() !== "") || n.kind === "heading",
  );
  if (meaningful.length === 0) {
    return <p className="text-xs text-muted">작성된 내용이 없습니다.</p>;
  }
  return (
    <div className="space-y-1.5">
      {meaningful.map((n, i) => {
        switch (n.kind) {
          case "heading":
            return (
              <p
                key={i}
                className="pt-2 text-sm font-bold text-ink first:pt-0"
              >
                <Runs runs={n.runs} />
              </p>
            );
          case "bullet":
            return (
              <p key={i} className="flex gap-1.5 pl-2 text-sm text-ink-soft">
                <span className="text-muted">•</span>
                <span>
                  <Runs runs={n.runs} />
                </span>
              </p>
            );
          case "numbered":
            return (
              <p key={i} className="flex gap-1.5 pl-2 text-sm text-ink-soft">
                <span className="text-muted">{i + 1}.</span>
                <span>
                  <Runs runs={n.runs} />
                </span>
              </p>
            );
          case "check":
            return (
              <p key={i} className="flex gap-1.5 pl-2 text-sm text-ink-soft">
                <span>{n.checked ? "☑" : "☐"}</span>
                <span className={n.checked ? "line-through text-muted" : ""}>
                  <Runs runs={n.runs} />
                </span>
              </p>
            );
          default:
            return (
              <p key={i} className="text-sm text-ink-soft">
                <Runs runs={n.runs} />
              </p>
            );
        }
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer border-b-2 px-1 pb-1.5 text-sm transition-colors ${
        active
          ? "border-ink font-semibold text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function MeetingView({ row }: ViewProps) {
  const [tab, setTab] = useState<"content" | "document">("content");
  const type = (row.meetingType ?? "regular") as MeetingType;
  const status = (row.meetingStatus ?? "draft") as MeetingStatus;
  const nodes = blocksToPdfModel((row.meetingContent ?? []) as Parameters<typeof blocksToPdfModel>[0]);
  const attendees = row.meetingAttendees ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-line-soft">
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          회의내용
        </TabButton>
        <TabButton
          active={tab === "document"}
          onClick={() => setTab("document")}
        >
          회의문서
        </TabButton>
      </div>

      {tab === "content" ? (
        <div className="space-y-6">
          <Section title="회의 정보">
            <DefList
              items={[
                { term: "제목", desc: row.meetingTitle ?? row.name ?? "-" },
                {
                  term: "유형",
                  desc: (
                    <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                      {MEETING_TYPE_LABELS[type]}
                    </span>
                  ),
                },
                {
                  term: "상태",
                  desc: (
                    <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                      {MEETING_STATUS_LABELS[status]}
                    </span>
                  ),
                },
                { term: "일시", desc: row.meetingDate || "-" },
                { term: "장소", desc: row.meetingLocation || "-" },
                {
                  term: "참석자",
                  desc: attendees.length > 0 ? attendees.join(", ") : "-",
                },
                { term: "작성자", desc: row.meetingAuthor || row.owner || "-" },
              ]}
            />
          </Section>

          <Divider />

          <Section title="내용">
            <DocBody nodes={nodes} />
          </Section>

          <Divider />

          <Link
            href={`/dashboard/meetings/${row.id}`}
            className="inline-block border border-line bg-paper px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            회의록 편집 화면 열기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 경위서식 문서 — 정해진 양식의 정식 회의록 */}
          <article className="border border-line bg-paper p-5 [box-shadow:3px_4px_0_rgba(21,18,12,0.08)]">
            <header className="mb-3 border-b border-ink pb-2">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                {MEETING_TYPE_LABELS[type]} 회의록
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                {row.meetingTitle ?? row.name ?? "제목 없음"}
              </h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-soft">
                <dt className="text-muted">일시</dt>
                <dd>{row.meetingDate || "-"}</dd>
                <dt className="text-muted">장소</dt>
                <dd>{row.meetingLocation || "-"}</dd>
                <dt className="text-muted">참석자</dt>
                <dd>{attendees.length > 0 ? attendees.join(", ") : "-"}</dd>
                <dt className="text-muted">작성자</dt>
                <dd>{row.meetingAuthor || row.owner || "-"}</dd>
              </dl>
            </header>
            <DocBody nodes={nodes} />
          </article>
          <Link
            href={`/dashboard/meetings/${row.id}`}
            className="inline-block border border-line bg-paper px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            편집·PDF·메일 화면 열기
          </Link>
        </div>
      )}
    </div>
  );
}
