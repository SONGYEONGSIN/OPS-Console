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
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange() {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveMeetingContent(id, editor.document);
      setSaved(res.ok);
    }, 800);
  }

  return (
    <div>
      <div className="mb-2 text-xs text-gold">
        {saved ? "✓ 자동 저장됨" : "저장 중…"}
      </div>
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
}
