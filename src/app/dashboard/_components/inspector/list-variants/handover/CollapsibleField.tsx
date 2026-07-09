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
        className="flex w-full cursor-pointer items-center gap-2 py-2.5"
      >
        <span className="text-lg leading-none text-muted">
          {open ? "▾" : "▸"}
        </span>
        {/* 섹션 제목 — 시트 안의 소제목 위계 */}
        <span className="text-base font-bold text-ink">{label}</span>
        <span
          className={`ml-auto inline-block px-2.5 py-1 text-xs ${
            filled ? "bg-ink text-cream" : "bg-vermilion text-cream"
          }`}
        >
          {filled ? "작성완료" : "미작성"}
        </span>
      </button>
      {open && <div className="pb-3 text-xs">{children}</div>}
    </div>
  );
}
