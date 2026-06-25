"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuoteWithType } from "@/features/quotes/document-actions";
import { QUOTE_TYPES, QUOTE_TYPE_LABELS } from "@/features/quotes/document-schema";
import { ModalShell } from "@/components/common/ModalShell";

export function NewQuoteButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function pick(type: (typeof QUOTE_TYPES)[number]) {
    setBusy(true);
    const res = await createQuoteWithType(type);
    if (res.ok && res.id) {
      router.push(`/dashboard/quotes/${res.id}`);
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
        className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion-deep"
      >
        + 새 견적서
      </button>
      {open && (
        <ModalShell
          title="견적서 유형 선택"
          onClose={() => !busy && setOpen(false)}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {QUOTE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => pick(t)}
                className="cursor-pointer border border-line-soft px-3 py-2 text-left text-sm hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {QUOTE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </ModalShell>
      )}
    </>
  );
}
