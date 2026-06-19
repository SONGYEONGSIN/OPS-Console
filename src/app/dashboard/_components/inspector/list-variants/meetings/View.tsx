"use client";

import Link from "next/link";
import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  type MeetingType,
  type MeetingStatus,
} from "@/features/meetings/schemas";

export function MeetingView({ row }: ViewProps) {
  const type = (row.meetingType ?? "regular") as MeetingType;
  const status = (row.meetingStatus ?? "draft") as MeetingStatus;
  return (
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
            { term: "작성자", desc: row.meetingAuthor || row.owner || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="원문">
        <Link
          href={`/dashboard/meetings/${row.id}`}
          className="inline-block border border-line bg-paper px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
        >
          회의록 편집 화면 열기
        </Link>
      </Section>
    </div>
  );
}
