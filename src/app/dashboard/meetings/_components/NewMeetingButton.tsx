"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/features/meetings/actions";
import { MEETING_TYPES, MEETING_TYPE_LABELS } from "@/features/meetings/schemas";

export function NewMeetingButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function pick(type: (typeof MEETING_TYPES)[number]) {
    setBusy(true);
    const res = await createMeeting(type);
    if (res.ok && res.id) {
      router.push(`/dashboard/meetings/${res.id}`);
    } else {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-ink bg-ink px-3 py-1.5 text-sm text-cream hover:bg-ink-soft"
      >
        + 새 회의록
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/30"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-[320px] border border-ink bg-cream p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-bold">회의 유형 선택</p>
            <div className="flex flex-col gap-2">
              {MEETING_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(t)}
                  className="border border-line-soft px-3 py-2 text-left text-sm hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-50"
                >
                  {MEETING_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
