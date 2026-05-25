"use client";

import { useState } from "react";
import { NewReportModal } from "./NewReportModal";

export function NewReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs text-cream hover:opacity-90"
      >
        + 새 리포트
      </button>
      <NewReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
