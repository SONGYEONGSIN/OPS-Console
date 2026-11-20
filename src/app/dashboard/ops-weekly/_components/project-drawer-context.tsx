"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProjectKind } from "@/features/ops-weekly/constants";
import { replaceOpsQuery, useOpsQueryValue } from "./use-ops-query";

type DrawerState = {
  openKind: ProjectKind | null;
  open: (kind: ProjectKind) => void;
  close: () => void;
  /** 포커스·주소를 건드리지 않고 [쓰기]로 연 서랍만 닫는다 — 밖(KPI 카드)에서 영역을 옮길 때. */
  dismiss: () => void;
};

const DrawerContext = createContext<DrawerState | null>(null);

function urlKindOf(tab: string | null): ProjectKind | null {
  return tab === "project" || tab === "tf" ? tab : null;
}

/**
 * 프로젝트·TF 서랍의 열림 상태. 주소(`tab=project|tf`)로 들어오면 열린 채 시작하고,
 * [쓰기]로 연 것은 주소를 안 바꾼다(왼쪽 영역을 잃지 않는다).
 */
export function ProjectDrawerProvider({ children }: { children: ReactNode }) {
  const urlTab = useOpsQueryValue("tab");
  const urlKind = urlKindOf(urlTab);
  const [localKind, setLocalKind] = useState<ProjectKind | null>(null);
  // 연 버튼 — 닫을 때 포커스를 거기로 돌려준다(서랍 안 요소는 inert 가 돼 포커스가 body 로 떨어진다).
  const openerRef = useRef<HTMLElement | null>(null);
  const open = useCallback((kind: ProjectKind) => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
    setLocalKind(kind);
  }, []);
  const close = useCallback(() => {
    setLocalKind(null);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
    // 주소가 서랍을 가리키고 있으면 그대로 두면 닫아도 다시 열린다 — 처음 영역으로 돌린다.
    if (urlKind !== null) replaceOpsQuery({ tab: "application", sub: null });
  }, [urlKind]);
  const dismiss = useCallback(() => {
    openerRef.current = null;
    setLocalKind(null);
  }, []);
  // 서랍은 내 보고서에만 있다 — 제출 현황·관리로 가도 이 Provider 는 남으니 열린 채 따라가지 않게 닫는다.
  const outsideReport = urlTab === "status" || urlTab === "settings";
  if (outsideReport && localKind !== null) setLocalKind(null);
  const value = useMemo(
    () => ({ openKind: localKind ?? urlKind, open, close, dismiss }),
    [localKind, urlKind, open, close, dismiss],
  );
  return (
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  );
}

export function useProjectDrawer(): DrawerState {
  const ctx = useContext(DrawerContext);
  if (ctx === null) {
    throw new Error("useProjectDrawer 는 ProjectDrawerProvider 안에서 쓴다");
  }
  return ctx;
}

/** Provider 밖(제출 현황 등 서랍이 없는 자리)에서는 아무 일도 안 한다. */
export function useDismissProjectDrawer(): () => void {
  return useContext(DrawerContext)?.dismiss ?? noop;
}

function noop(): void {}
