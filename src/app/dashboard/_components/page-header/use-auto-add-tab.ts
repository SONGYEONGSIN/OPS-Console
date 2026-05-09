"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { useOpenTabs } from "./open-tabs-context";

/**
 * 현재 pathname이 group child면 탭에 자동 push.
 * PageTabs 컴포넌트에서 호출.
 */
export function useAutoAddTab() {
  const pathname = usePathname();
  const { add, isGroupChild } = useOpenTabs();

  useEffect(() => {
    if (!isGroupChild(pathname)) return;
    const slug = pathname.replace("/dashboard/", "");
    const meta = findSidebarMeta(slug);
    if (!meta) return;
    add({ slug, href: pathname, label: meta.label });
  }, [pathname, add, isGroupChild]);
}
