"use client";

import { useCallback, useState } from "react";
import { AssistantClient } from "./AssistantClient";
import { InspectorPanel } from "../inspector/InspectorPanel";
import type { CurrentOperator } from "@/features/auth/queries";

/**
 * 어시스턴트 채팅 런처 — 우하단 고정 버튼 + 인스펙터 슬라이드인 패널.
 *
 * 패널은 표준 InspectorPanel을 그대로 쓴다. 슬라이드인·ESC·외부 클릭 닫힘이
 * 거기 이미 있고, 채팅만 다른 셸을 쓰면 화면마다 드로어 동작이 갈린다.
 * 폭만 표준(320px)보다 넓힌다 — 대화는 가로로 읽는 글이라 320px에서 답답하다.
 *
 * 패널은 열림/닫힘과 무관하게 항상 마운트된다(InspectorPanel이 transform으로만
 * 숨긴다). 언마운트하면 닫을 때마다 대화가 통째로 날아간다.
 */
export function AssistantLauncher({ me }: { me: CurrentOperator | null }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // /api/assistant/ask가 viewer를 403으로 막는다 — 눌러도 실패할 버튼은 안 그린다.
  if (!me || me.permission === "viewer") return null;

  const userName = me.displayName || me.email.split("@")[0] || "운영자";

  return (
    <>
      <InspectorPanel
        open={open}
        onClose={close}
        widthClassName="md:w-[460px]"
        bodyClassName="flex h-full flex-col overflow-hidden"
      >
        {/* InspectorChrome은 ListRow(id·상태 뱃지)를 요구해 채팅에 맞지 않는다.
            가짜 row를 지어내지 않고 헤더 관례(eyebrow + 굵은 구분선)만 따른다. */}
        <header className="shrink-0 border-b-2 border-ink px-5 pb-4 pt-5">
          <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
            어시스턴트 · 사내 데이터 질의
          </p>
          <h3 className="text-xl font-bold tracking-[-0.01em] text-ink">
            무엇을 찾으시나요
          </h3>
        </header>
        <div className="min-h-0 flex-1">
          <AssistantClient userName={userName} variant="panel" />
        </div>
      </InspectorPanel>

      <button
        type="button"
        aria-label="어시스턴트"
        aria-expanded={open}
        // InspectorPanel은 document mousedown으로 외부 클릭을 판정한다. 런처는
        // 패널 밖이라, 막지 않으면 mousedown이 먼저 닫고 이어진 click 토글이
        // 다시 열어버려 "열린 상태에서 런처를 눌러도 안 닫히는" 상태가 된다.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        // 상태바가 bottom-[27px]까지 차지한다 — 그 위로 확실히 띄운다.
        className="fixed bottom-14 right-6 z-40 inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-ink text-cream shadow-offset transition-colors hover:bg-vermilion"
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
