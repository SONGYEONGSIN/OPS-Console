"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import type { OperatorPermission } from "@/features/operators/schemas";

type Props = {
  displayName: string;
  email: string;
  role: string;
  team: "운영1팀" | "운영2팀" | null;
  /** admin이면 시스템 설정 메뉴 노출 (settings는 admin 전용) */
  permission?: OperatorPermission | null;
};

export function ChromeUser({
  displayName,
  email,
  role,
  team,
  permission,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const subtitle = team ? `${team} · ${role}` : role;
  const isAdmin = permission === "admin";

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
          className="absolute right-0 top-full z-[200] mt-2 min-w-[200px] border border-chrome-graphite bg-paper py-1 text-ink [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
        >
          <div className="border-b border-line-soft px-3 py-2">
            <p className="text-sm font-bold text-ink">{displayName}</p>
            <p className="text-xs text-ink-soft">{subtitle}</p>
            <p className="mt-0.5 text-xs text-muted">{email}</p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard/settings");
              }}
              className="w-full border-none bg-transparent px-3 py-2 text-left text-sm hover:bg-vermilion hover:text-cream cursor-pointer"
            >
              시스템 설정
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="w-full border-none bg-transparent px-3 py-2 text-left text-sm hover:bg-vermilion hover:text-cream cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
