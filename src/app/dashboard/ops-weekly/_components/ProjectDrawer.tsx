"use client";

import { useState, type ReactNode } from "react";
import type { ProjectKind } from "@/features/ops-weekly/constants";
import { InspectorPanel } from "../../_components/inspector/InspectorPanel";
import { useProjectDrawer } from "./project-drawer-context";
import { ROW_BTN_CLASS } from "./styles";

const KINDS: readonly ProjectKind[] = ["project", "tf"];
const TITLE: Record<ProjectKind, string> = { project: "프로젝트", tf: "TF" };

type Props = { panels: Record<ProjectKind, ReactNode> };

/**
 * 프로젝트·TF 서랍. 두 패널을 늘 마운트하고 `hidden` 으로만 가려 쓰던 글이 남는다.
 * 닫힌 동안은 내용 전체(머리 줄 포함)를 `inert` 로 막아 키보드가 안 들어가게 한다 —
 * InspectorPanel 은 닫혀도 내용을 렌더하고 `aria-hidden` 만 건다.
 */
export function ProjectDrawer({ panels }: Props) {
  const { openKind, close } = useProjectDrawer();
  const [last, setLast] = useState<ProjectKind>("project");
  // 닫히는 동안에도 마지막으로 연 쪽을 보여 준다(슬라이드 아웃 중 내용이 바뀌지 않게).
  if (openKind !== null && openKind !== last) setLast(openKind);
  const shown = openKind ?? last;
  return (
    <InspectorPanel
      open={openKind !== null}
      onClose={close}
      widthClassName="md:w-[min(48rem,100vw)]"
    >
      <div
        inert={openKind === null ? true : undefined}
        className="flex flex-col gap-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{TITLE[shown]}</h2>
          <button type="button" onClick={close} className={ROW_BTN_CLASS}>
            닫기
          </button>
        </div>
        {KINDS.map((kind) => (
          <div key={kind} hidden={shown !== kind}>
            {panels[kind]}
          </div>
        ))}
      </div>
    </InspectorPanel>
  );
}
