"use client";

import { createContext, useContext, type ReactNode } from "react";
import { OPS_WEEKLY_PATH } from "@/features/ops-weekly/constants";

/**
 * 지금 화면이 어느 메뉴 주소인지 — 기존 주간업무보고와 새 화면 메뉴가 같은 부품을 써서, 링크가 자기 메뉴에 머물게 한다.
 * 기본값이 기존 메뉴라 Provider 밖(기존 화면·테스트)은 예전과 같다.
 */
const OpsPathContext = createContext<string>(OPS_WEEKLY_PATH);

export function OpsPathProvider({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return <OpsPathContext value={path}>{children}</OpsPathContext>;
}

export function useOpsPath(): string {
  return useContext(OpsPathContext);
}
