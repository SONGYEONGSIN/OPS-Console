"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Inspector 슬라이드인 셸 (Epic 3).
 * - open 시 우측에서 슬라이드인 (380px @ md+, 100vw @ <md)
 * - ESC / 외부 클릭 / 닫기 버튼 모두 onClose 트리거
 */
export function InspectorPanel({ open, onClose, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  return (
    <aside
      ref={ref}
      role="complementary"
      aria-hidden={!open}
      className={`fixed right-0 top-12 bottom-6 z-40 w-full bg-washi-raised border-l border-line transition-transform duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] [box-shadow:var(--shadow-drawer-right)] md:top-[52px] md:bottom-[26px] md:w-[320px] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-ink hover:text-vermilion"
      >
        ×
      </button>
      <div className="h-full overflow-y-auto p-5 pt-12">{children}</div>
    </aside>
  );
}
