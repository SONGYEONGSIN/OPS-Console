"use client";

import Link from "next/link";
import type { ViewProps } from "../types";
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
    <div className="space-y-4">
      <section className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{MEETING_TYPE_LABELS[type]}</span>
          <span className="ml-auto">{MEETING_STATUS_LABELS[status]}</span>
        </div>
        <p className="text-sm font-medium text-ink">
          {row.meetingTitle ?? row.name}
        </p>
        {row.meetingDate && (
          <p className="text-xs text-muted">일시 {row.meetingDate}</p>
        )}
      </section>

      <Link
        href={`/dashboard/meetings/${row.id}`}
        className="inline-block border border-ink px-3 py-1 hover:bg-ink hover:text-cream"
      >
        편집 화면 열기
      </Link>
    </div>
  );
}
