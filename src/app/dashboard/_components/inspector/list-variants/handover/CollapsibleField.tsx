"use client";

import { useState, type ReactNode } from "react";

/**
 * 접이식 필드 — 작업 탭처럼 필드가 많은 카테고리에서 사용.
 * 헤더(▸/▾ + 작성여부 도트 + 라벨 + 미작성 칩) 클릭으로 본문 토글.
 */
export function CollapsibleField({
  label,
  filled,
  defaultOpen = false,
  children,
}: {
  label: string;
  filled: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line-soft">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 py-2 text-xs"
      >
        <span className="text-faint">{open ? "▾" : "▸"}</span>
        <span
          aria-hidden
          className={`text-[0.6rem] ${filled ? "text-sage" : "text-faint"}`}
        >
          {filled ? "●" : "○"}
        </span>
        <span className="font-bold text-ink-soft">{label}</span>
        {!filled && (
          <span className="ml-auto border border-line-soft bg-washi px-1.5 py-0.5 text-2xs text-muted">
            미작성
          </span>
        )}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}
