"use client";

import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/features/meetings/actions";
import { MEETING_TYPES, MEETING_TYPE_LABELS } from "@/features/meetings/schemas";
import { ModalShell } from "@/components/common/ModalShell";

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
      <HeaderActionButton onClick={() => setOpen(true)}>
        + 새 회의록
      </HeaderActionButton>
      {open && (
        <ModalShell
          title="회의 유형 선택"
          onClose={() => !busy && setOpen(false)}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {MEETING_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => pick(t)}
                className="cursor-pointer border border-line-soft px-3 py-2 text-left text-sm hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {MEETING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </ModalShell>
      )}
    </>
  );
}
