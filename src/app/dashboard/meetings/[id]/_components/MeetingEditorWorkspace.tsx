"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { MeetingRow } from "@/features/meetings/schemas";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/features/meetings/schemas";
import {
  updateMeetingMeta,
  saveMeetingContent,
} from "@/features/meetings/actions";
import { sendMeetingMinutes } from "@/features/meetings/mail-actions";
import { MeetingForm } from "../../_components/MeetingForm";
import { isMeetingDoc, type MeetingDoc } from "@/features/meetings/form-model";

function parseAttendees(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ISO → datetime-local 값 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function MeetingEditorWorkspace({ meeting }: { meeting: MeetingRow }) {
  const [title, setTitle] = useState(meeting.title);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [meetingDate, setMeetingDate] = useState(
    meeting.meeting_date ? toLocalInput(meeting.meeting_date) : "",
  );
  const [attendees, setAttendees] = useState(meeting.attendees.join(", "));
  const [doc, setDoc] = useState<MeetingDoc | null>(
    isMeetingDoc(meeting.content) ? meeting.content : null,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function saveMeta(over?: { title?: string }) {
    await updateMeetingMeta(meeting.id, {
      title: over?.title ?? title,
      location: location || null,
      meeting_date: fromLocalInput(meetingDate),
      attendees: parseAttendees(attendees),
    });
  }

  function onDocChange(next: MeetingDoc) {
    setDoc(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveMeetingContent(meeting.id, next);
      setSaved(res.ok);
    }, 800);
  }

  async function send() {
    setBusy(true);
    const res = await sendMeetingMinutes(meeting.id, parseAttendees(attendees));
    setBusy(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 상단바 — 목록 이동 / PDF / 메일 발송 (저장표시·상태배지는 문서 영역 안으로) */}
      <div className="mb-3 flex items-center justify-between">
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
            className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream"
          >
            PDF
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            메일 발송
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2">
        {doc ? (
          <MeetingForm
            doc={doc}
            onChange={onDocChange}
            masthead={{
              typeLabel: MEETING_TYPE_LABELS[meeting.type],
              saveLabel: saved ? "✓ 자동 저장됨" : "저장 중…",
              statusLabel: MEETING_STATUS_LABELS[meeting.status],
              statusDraft: meeting.status === "draft",
              title,
              onTitle: (v) => {
                setTitle(v);
                void saveMeta({ title: v });
              },
              dateValue: meetingDate,
              location,
              attendees,
              onDate: setMeetingDate,
              onLocation: setLocation,
              onAttendees: setAttendees,
              onMetaBlur: saveMeta,
            }}
          />
        ) : (
          <p className="p-6 text-sm text-muted">
            이 회의록은 구버전 양식으로 작성되어 편집할 수 없습니다. 새 회의록을
            작성해 주세요.
          </p>
        )}
      </div>
    </div>
  );
}
