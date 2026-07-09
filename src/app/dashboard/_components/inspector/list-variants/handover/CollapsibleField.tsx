"use client";

import { useState, type ReactNode } from "react";

/**
 * 접이식 필드 — 작업 탭처럼 필드가 많은 카테고리에서 사용.
 * 헤더(▸/▾ + 작성여부 도트 + 라벨 + 미작성 칩) 클릭으로 본문 토글.
 *
 * 크림 바탕(bg-paper) 위에 흰 카드로 떠 있어 섹션 경계가 드러난다.
 * 회의록 편집기의 문서 시트와 같은 결.
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
    <div className="border border-line bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-xs ${
          open ? "border-b border-line-soft" : ""
        }`}
      >
        <span className="text-base leading-none text-muted">
          {open ? "▾" : "▸"}
        </span>
        <span className="font-bold text-ink-soft">{label}</span>
        <span
          className={`ml-auto inline-block px-2 py-0.5 text-2xs ${
            filled ? "bg-ink text-cream" : "bg-vermilion text-cream"
          }`}
        >
          {filled ? "작성완료" : "미작성"}
        </span>
      </button>
      {open && <div className="px-4 py-3 text-xs">{children}</div>}
    </div>
  );
}
