"use client";

import { useState, useTransition } from "react";
import { setAutoDraftEnabled } from "@/features/mailbox/actions";

type Props = { ownerEmail: string; initialEnabled: boolean };

export function AutoDraftToggle({ ownerEmail, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const r = await setAutoDraftEnabled(ownerEmail, next);
      if (!r.ok) {
        setEnabled(!next);
        alert(`설정 변경 실패: ${r.error ?? "알 수 없는 오류"}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      className={`cursor-pointer border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        enabled
          ? "border-vermilion bg-vermilion text-cream hover:bg-vermilion-deep"
          : "border-line bg-transparent text-muted hover:bg-ink hover:text-cream"
      }`}
    >
      자동 초안 {enabled ? "ON" : "OFF"}
    </button>
  );
}
