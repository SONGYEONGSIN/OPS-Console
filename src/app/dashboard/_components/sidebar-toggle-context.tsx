"use client";

import { createContext, useContext } from "react";

type SidebarToggle = {
  open: () => void;
};

const Ctx = createContext<SidebarToggle | null>(null);

export function SidebarToggleProvider({
  open,
  children,
}: {
  open: () => void;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ open }}>{children}</Ctx.Provider>;
}

export function useSidebarToggle(): SidebarToggle {
  const v = useContext(Ctx);
  if (!v)
    throw new Error("useSidebarToggle은 SidebarToggleProvider 안에서만 사용");
  return v;
}
