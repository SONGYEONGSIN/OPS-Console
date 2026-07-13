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
import { isMeetingDoc } from "@/features/meetings/form-model";
import { formatMeetingDateKst } from "@/features/meetings/format-meeting-date";
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
    (n) =>
      n.kind === "heading" ||
      n.kind === "table" ||
      n.runs.some((r) => r.text.trim() !== ""),
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
              <p key={i} className="pt-2 text-sm font-bold text-ink first:pt-0">
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
          case "table":
            return (
              <table
                key={i}
                className="w-full border-collapse text-xs text-ink-soft"
              >
                <tbody>
                  {n.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => {
                        const isHead = ri < n.headerRows;
                        const Cell = isHead ? "th" : "td";
                        return (
                          <Cell
                            key={ci}
                            className={`border border-line-soft px-1.5 py-1 text-left align-top ${
                              isHead
                                ? "bg-washi-raised font-semibold text-ink"
                                : ""
                            }`}
                          >
                            <Runs runs={cell} />
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
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

function runsText(runs: PdfRun[]): string {
  return runs.map((r) => r.text).join("");
}

/** PdfNode[]를 heading 기준으로 섹션 분할 — 경위서식 라벨+내용박스 렌더용. */
function groupByHeading(
  nodes: PdfNode[],
): { title: string | null; body: PdfNode[] }[] {
  const sections: { title: string | null; body: PdfNode[] }[] = [];
  let cur: { title: string | null; body: PdfNode[] } = {
    title: null,
    body: [],
  };
  for (const n of nodes) {
    if (n.kind === "heading") {
      if (cur.title !== null || cur.body.length > 0) sections.push(cur);
      cur = { title: runsText(n.runs) || "(제목 없음)", body: [] };
    } else {
      cur.body.push(n);
    }
  }
  if (cur.title !== null || cur.body.length > 0) sections.push(cur);
  return sections;
}

function bodyHasText(body: PdfNode[]): boolean {
  return body.some((n) =>
    n.kind === "table" ? true : n.runs.some((r) => r.text.trim() !== ""),
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
      className={`flex-1 cursor-pointer border-b-2 px-1 pb-1.5 text-center text-sm transition-colors ${
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
  // v2 양식이면 섹션 제목을 heading 노드로 요약(전체 양식·표는 편집 화면에서).
  // v1(BlockNote 블록 배열)이면 기존 변환.
  const v2doc = isMeetingDoc(row.meetingContent) ? row.meetingContent : null;
  const nodes: PdfNode[] = v2doc
    ? v2doc.sections.flatMap((s) =>
        "title" in s
          ? [
              {
                kind: "heading" as const,
                level: 2 as const,
                runs: [{ text: s.title, bold: false, italic: false }],
              },
            ]
          : [],
      )
    : blocksToPdfModel(
        (row.meetingContent ?? []) as Parameters<typeof blocksToPdfModel>[0],
      );
  const sections = groupByHeading(nodes);
  const attendees = row.meetingAttendees ?? [];

  return (
    <div className="space-y-4">
      <div className="flex border-b border-line-soft">
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
          {/* 헤더 — 제목 + 상태 배지 + 분류(유형) (사고정보 탭 형식) */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">
                {row.meetingTitle ?? row.name ?? "제목 없음"}
              </span>
              <span className="ml-auto inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft">
                {MEETING_STATUS_LABELS[status]}
              </span>
            </div>
            <p className="text-xs text-muted">{MEETING_TYPE_LABELS[type]}</p>
          </section>

          <Divider />

          <Section title="회의 정보">
            <DefList
              items={[
                { term: "일시", desc: formatMeetingDateKst(row.meetingDate) },
                { term: "장소", desc: row.meetingLocation || "—" },
                {
                  term: "참석자",
                  desc: attendees.length > 0 ? attendees.join(", ") : "—",
                },
                { term: "작성자", desc: row.meetingAuthor || row.owner || "—" },
              ]}
            />
          </Section>

          <Divider />

          <Section title="내용">
            <DocBody nodes={nodes} />
          </Section>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 경위서식 — 헤더 + 섹션별 라벨/내용박스 */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">
                {row.meetingTitle ?? row.name ?? "제목 없음"}
                <span className="ml-1.5 text-xs font-normal text-muted">
                  · {MEETING_TYPE_LABELS[type]}
                </span>
              </span>
              <span className="ml-auto inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft">
                {MEETING_STATUS_LABELS[status]}
              </span>
            </div>
            <p className="text-xs text-muted">
              {[
                row.meetingDate ? formatMeetingDateKst(row.meetingDate) : null,
                row.meetingLocation || null,
                attendees.length > 0 ? `참석 ${attendees.length}명` : null,
                row.meetingAuthor || row.owner || null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </section>

          <Link
            href={`/dashboard/meetings/${row.id}`}
            className="block w-full cursor-pointer border border-line bg-transparent px-3 py-1.5 text-center text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            회의록 내용 보기
          </Link>

          <Divider />

          {sections.length === 0 ? (
            <p className="text-xs text-muted">작성된 내용이 없습니다.</p>
          ) : (
            sections.map((s, i) => (
              <Section key={i} title={s.title ?? "개요"}>
                <div className="rounded bg-washi-raised p-2.5">
                  {bodyHasText(s.body) ? (
                    <DocBody nodes={s.body} />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              </Section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
