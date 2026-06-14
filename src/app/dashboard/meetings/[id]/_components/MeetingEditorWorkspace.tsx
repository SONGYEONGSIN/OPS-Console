"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { MeetingRow } from "@/features/meetings/schemas";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
} from "@/features/meetings/schemas";
import { updateMeetingMeta } from "@/features/meetings/actions";
import { sendMeetingMinutes } from "@/features/meetings/mail-actions";

const MeetingEditor = dynamic(
  () => import("../../_components/MeetingEditor").then((m) => m.MeetingEditor),
  { ssr: false, loading: () => <p className="text-sm text-muted">에디터 로딩…</p> },
);

function parseAttendees(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MeetingEditorWorkspace({ meeting }: { meeting: MeetingRow }) {
  const [title, setTitle] = useState(meeting.title);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [attendees, setAttendees] = useState(meeting.attendees.join(", "));
  const [busy, setBusy] = useState(false);

  async function saveMeta() {
    await updateMeetingMeta(meeting.id, {
      title,
      location: location || null,
      meeting_date: meeting.meeting_date ?? null,
      attendees: parseAttendees(attendees),
    });
  }

  async function send() {
    setBusy(true);
    const res = await sendMeetingMinutes(meeting.id, parseAttendees(attendees));
    setBusy(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <div className="mx-auto max-w-[820px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="bg-line-soft px-2 py-0.5 text-xs">
          {MEETING_TYPE_LABELS[meeting.type]}
        </span>
        <div className="flex items-center gap-2">
          <span className="bg-line-soft px-2 py-0.5 text-xs">
            {MEETING_STATUS_LABELS[meeting.status]}
          </span>
          <a
            href={`/api/meetings/${meeting.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-3 py-1 text-sm hover:bg-ink hover:text-cream"
          >
            PDF
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="border border-ink bg-ink px-3 py-1 text-sm text-cream disabled:opacity-50"
          >
            메일 발송
          </button>
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveMeta}
        className="mb-3 w-full border-none text-2xl font-black outline-none"
        placeholder="제목 없음"
      />
      <div className="mb-1 flex gap-2 text-sm">
        <span className="w-14 text-muted">장소</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={saveMeta}
          className="flex-1 bg-line-soft px-2 py-1"
        />
      </div>
      <div className="mb-4 flex gap-2 text-sm">
        <span className="w-14 text-muted">참석자</span>
        <input
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          onBlur={saveMeta}
          className="flex-1 bg-line-soft px-2 py-1"
          placeholder="쉼표로 구분"
        />
      </div>
      <hr className="mb-4 border-line-soft" />
      <MeetingEditor id={meeting.id} initialContent={meeting.content} />
    </div>
  );
}
