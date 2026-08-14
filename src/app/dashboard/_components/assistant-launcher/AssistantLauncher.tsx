"use client";

import { useEffect, useState } from "react";
import { AssistantClient } from "../../ai-assistant/AssistantClient";
import type { CurrentOperator } from "@/features/auth/queries";

/**
 * 어시스턴트 채팅 런처 — 우하단 고정 버튼 + 도킹 패널.
 *
 * 모달이 아니라 도킹 패널이라 ModalShell을 쓰지 않는다. 뒤 화면을 계속 보면서
 * 쓰는 물건이라 스크림을 깔면 안 된다(헤더 모양만 ModalShell 관례를 따른다).
 *
 * 패널은 열림/닫힘과 무관하게 항상 마운트하고 hidden으로만 토글한다.
 * 언마운트하면 닫을 때마다 대화가 통째로 날아간다.
 */
export function AssistantLauncher({ me }: { me: CurrentOperator | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // /api/assistant/ask가 viewer를 403으로 막는다 — 눌러도 실패할 버튼은 안 그린다.
  if (!me || me.permission === "viewer") return null;

  const userName = me.displayName || me.email.split("@")[0] || "운영자";

  return (
    <>
      <div
        role="dialog"
        aria-label="어시스턴트"
        hidden={!open}
        className="fixed bottom-24 right-6 z-40 flex h-[600px] max-h-[calc(100vh-8rem)] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden border border-line bg-paper shadow-offset"
      >
        <div className="flex items-center justify-between bg-ink px-4 py-2.5">
          <h2 className="text-lg font-bold tracking-tight text-cream">
            어시스턴트
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border border-line bg-paper text-2xl leading-none text-ink-soft transition-colors hover:border-vermilion hover:text-vermilion"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AssistantClient userName={userName} variant="panel" />
        </div>
      </div>

      <button
        type="button"
        aria-label="어시스턴트"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-ink text-cream shadow-offset transition-colors hover:bg-vermilion"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          {open ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          )}
        </svg>
      </button>
    </>
  );
}
