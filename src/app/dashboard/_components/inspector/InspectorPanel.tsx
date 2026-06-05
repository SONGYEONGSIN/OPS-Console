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
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // 모달 등 앱 레벨 오버레이(#ops-modal-root) 내부 클릭은 외부 클릭으로 보지
      // 않는다 — 모달은 인스펙터 DOM 밖(portal)이라 contains로는 안 잡히기 때문.
      const modalRoot = document.getElementById("ops-modal-root");
      if (modalRoot?.contains(target)) return;
      onClose();
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
      className={`fixed right-0 top-[74px] bottom-[27px] z-40 w-full bg-cream border-l border-line transition-transform duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] [box-shadow:var(--shadow-drawer-right)] md:top-[78px] md:bottom-[27px] md:w-[320px] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* scrollbar-gutter:stable — 내용 길이에 따라 스크롤바가 생겼다 사라지며
          본문 폭이 출렁이는 현상 방지(스크롤바 공간을 항상 예약) */}
      <div className="h-full overflow-y-auto p-5 [scrollbar-gutter:stable]">
        {children}
      </div>
    </aside>
  );
}
