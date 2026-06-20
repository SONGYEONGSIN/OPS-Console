"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MeetingRow } from "@/features/meetings/schemas";
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
} from "@/features/meetings/schemas";
import { updateMeetingMeta } from "@/features/meetings/actions";
import { sendMeetingMinutes } from "@/features/meetings/mail-actions";
import { MeetingDocument } from "../../_components/MeetingDocument";

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

/** ISO 문자열 → `datetime-local` input 값(로컬 시간, "YYYY-MM-DDTHH:mm"). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` 값(로컬) → ISO 문자열. 빈 값이면 null. */
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function MeetingEditorWorkspace({ meeting }: { meeting: MeetingRow }) {
  const [title, setTitle] = useState(meeting.title);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [meetingDate, setMeetingDate] = useState(
    meeting.meeting_date ? toLocalInput(meeting.meeting_date) : "",
  );
  const [attendees, setAttendees] = useState(meeting.attendees.join(", "));
  const [content, setContent] = useState<unknown[]>(meeting.content);
  const [busy, setBusy] = useState(false);

  async function saveMeta() {
    await updateMeetingMeta(meeting.id, {
      title,
      location: location || null,
      meeting_date: fromLocalInput(meetingDate),
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 상단바 — 좌: 목록 이동(버튼) / 우: PDF·메일 발송 (경위서 편집과 동일 구조) */}
      <div className="mb-2 flex items-center justify-between">
        <Link
          href="/dashboard/meetings"
          className="inline-flex shrink-0 items-center border border-line px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          ← 목록 이동
        </Link>
        <div className="flex items-center gap-2">
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

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 좌측 — 실제 문서 미리보기 (편집 내용 실시간 반영, 내부 스크롤) */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <MeetingDocument
            title={title}
            typeLabel={MEETING_TYPE_LABELS[meeting.type]}
            dateDisplay={meetingDate.replace("T", " ")}
            location={location}
            attendees={parseAttendees(attendees)}
            content={content}
          />
        </div>

        {/* 우측 — 편집 패널 (헤더 고정 + 메타·에디터 내부 스크롤) */}
        <aside className="flex min-h-0 w-[400px] shrink-0 flex-col border-l border-line pl-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-ink">편집</span>
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${
                meeting.status === "draft"
                  ? "bg-vermilion text-cream"
                  : "bg-line-soft text-ink-soft"
              }`}
            >
              {MEETING_STATUS_LABELS[meeting.status]}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <span className="mb-2 inline-block bg-line-soft px-2 py-0.5 text-xs">
              {MEETING_TYPE_LABELS[meeting.type]}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveMeta}
              className="mb-3 w-full border-none bg-transparent text-xl font-black outline-none"
              placeholder="제목 없음"
            />
            <div className="mb-1 flex gap-2 text-sm">
              <span className="w-14 text-muted">일시</span>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                onBlur={saveMeta}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="flex-1 cursor-pointer bg-line-soft px-2 py-1"
              />
            </div>
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
            <MeetingEditor
              id={meeting.id}
              initialContent={meeting.content}
              onContentChange={setContent}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
