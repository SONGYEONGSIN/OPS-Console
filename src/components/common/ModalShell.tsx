"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SIZE_CLASS = {
  sm: "max-w-[360px]",
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 우측 정렬 액션 영역 (닫기/등록 등). 없으면 푸터 미렌더. */
  footer?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  ariaLabel?: string;
};

/**
 * 표준 모달 셸 — 모든 모달 팝업의 공통 기준.
 * 검정 헤더(타이틀 + boxed × 닫기) + 본문(스크롤) + 푸터(액션) 슬롯.
 * Esc / 바깥 클릭 / × 로 닫힘. 새 모달은 반드시 이 셸을 사용한다.
 */
export function ModalShell({
  title,
  onClose,
  children,
  footer,
  size = "md",
  ariaLabel,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className={`flex max-h-[85vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden border border-line bg-paper shadow-offset`}
      >
        {/* 검정 헤더 — 타이틀 + boxed × */}
        <div className="flex items-center justify-between bg-ink px-4 py-2.5">
          <h2 className="text-sm font-bold tracking-tight text-cream">
            {title}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border border-line bg-paper text-2xl leading-none text-ink-soft transition-colors hover:border-vermilion hover:text-vermilion"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
