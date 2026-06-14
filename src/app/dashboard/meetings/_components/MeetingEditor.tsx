"use client";

import { useEffect, useRef, useState } from "react";
import type { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { saveMeetingContent } from "@/features/meetings/actions";

type Props = { id: string; initialContent: unknown[] };

export function MeetingEditor({ id, initialContent }: Props) {
  const editor = useCreateBlockNote({
    initialContent:
      initialContent.length > 0
        ? (initialContent as PartialBlock[])
        : undefined,
  });
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange() {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveMeetingContent(id, editor.document);
      setStatus(res.ok ? "saved" : "error");
    }, 800);
  }

  const statusLabel =
    status === "saved"
      ? "✓ 자동 저장됨"
      : status === "saving"
        ? "저장 중…"
        : "저장 실패 — 재시도";

  return (
    <div>
      <div
        className={`mb-2 text-xs ${status === "error" ? "text-vermilion" : "text-gold"}`}
      >
        {statusLabel}
      </div>
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
}
