"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** md+ 폭. 기본은 표준 320px — 대화처럼 가로로 읽는 본문만 넓힌다. */
  widthClassName?: string;
  /**
   * 본문 컨테이너 클래스. 기본은 단일 스크롤 + p-5.
   * 바닥에 고정할 요소가 있는 본문(채팅 입력창 등)은 flex 레이아웃으로 바꾼다.
   */
  bodyClassName?: string;
  children: React.ReactNode;
};

/**
 * Inspector 슬라이드인 셸 (Epic 3).
 * - open 시 우측에서 슬라이드인 (380px @ md+, 100vw @ <md)
 * - ESC / 외부 클릭 / 닫기 버튼 모두 onClose 트리거
 */
export function InspectorPanel({
  open,
  onClose,
  widthClassName = "md:w-[320px]",
  // scrollbar-gutter:stable — 내용 길이에 따라 스크롤바가 생겼다 사라지며
  // 본문 폭이 출렁이는 현상 방지(스크롤바 공간을 항상 예약)
  bodyClassName = "h-full overflow-y-auto p-5 [scrollbar-gutter:stable]",
  children,
}: Props) {
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
    <>
      {/*
        모바일 딤. 이 패널은 좁은 화면에서 폭을 다 쓰기 때문에 "바깥"이 위쪽
        얇은 띠뿐이고, 딤이 없으면 그게 닫을 수 있는 곳으로 보이지 않는다 —
        실제로 닫는 방법이 없다는 제보가 왔다(2026-08-25). 사이드바가 쓰는
        방식 그대로다.

        데스크톱은 패널이 본문 옆에 붙어 있어 가릴 이유가 없다(md:hidden).
      */}
      <div
        data-testid="inspector-dim"
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-[35] bg-ink/35 transition-opacity duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={ref}
        role="complementary"
        aria-hidden={!open}
        className={`fixed right-0 top-[74px] bottom-[27px] z-40 w-full bg-paper border-l border-line transition-transform duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] [box-shadow:var(--shadow-drawer-right)] md:top-[52px] md:bottom-[27px] ${widthClassName} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className={bodyClassName}>{children}</div>
      </aside>
    </>
  );
}
