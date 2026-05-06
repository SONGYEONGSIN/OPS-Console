"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";

type Props = {
  displayName: string;
  role: string;
  team: "운영1팀" | "운영2팀" | null;
};

export function ChromeUser({ displayName, role, team }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const subtitle = team ? `${team} · ${role}` : role;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex flex-col items-end leading-none border-none bg-transparent p-0 cursor-pointer"
      >
        <span className="text-sm font-bold text-chrome-graphite">{displayName}</span>
        <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.18em] text-chrome-muted">
          {subtitle}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 min-w-[200px] border border-chrome-graphite bg-cream py-1 text-ink [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-2.5 border-none bg-transparent px-3 py-1.5 text-left text-xs hover:bg-vermilion hover:text-cream cursor-pointer"
          >
            <span>로그아웃</span>
            <span className="text-2xs tracking-[0.04em] text-muted">⇧⌘Q</span>
          </button>
        </div>
      )}
    </div>
  );
}
