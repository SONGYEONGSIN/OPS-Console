"use client";

import { useState } from "react";
import { NewRoundModal } from "./NewRoundModal";

type Props = {
  rounds: { id: string; title: string }[];
};

export function NewRoundButton({ rounds }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream hover:opacity-90"
      >
        + 새 회차
      </button>
      {open ? (
        <NewRoundModal rounds={rounds} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
