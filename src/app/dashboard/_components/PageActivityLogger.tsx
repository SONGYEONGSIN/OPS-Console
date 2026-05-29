"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SbSection } from "../_data";
import { findSidebarLabel } from "../_data/sidebar-helpers";

type Props = {
  sections: SbSection[];
};

/**
 * 페이지 진입/이탈 자동 로깅. dashboard layout에 한 번만 mount.
 * usePathname()으로 pathname 변경 감지 → useEffect의 deps에 반영 → 페이지 이동마다 enter/leave 발생.
 *
 * - 진입: fetch (DEBUG 레벨, domain=nav, action=enter)
 * - 이탈: sendBeacon (탭 닫기/메뉴 이동도 보존, action=leave)
 */
export function PageActivityLogger({ sections }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/dashboard/")) return;
    const slug = pathname.replace("/dashboard/", "").split("/")[0] ?? "";
    if (!slug) return;
    const label = findSidebarLabel(sections, slug);

    fetch("/api/worklog/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "DEBUG",
        domain: "nav",
        action: "enter",
        target_type: "page",
        target_id: slug,
        target_name: label,
        msg: `페이지 진입 — ${label}`,
      }),
      keepalive: true,
    }).catch(() => {});

    return () => {
      const payload = JSON.stringify({
        level: "DEBUG",
        domain: "nav",
        action: "leave",
        target_type: "page",
        target_id: slug,
        target_name: label,
        msg: `페이지 이탈 — ${label}`,
      });
      try {
        navigator.sendBeacon(
          "/api/worklog/log",
          new Blob([payload], { type: "application/json" }),
        );
      } catch {
        fetch("/api/worklog/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [pathname, sections]);

  return null;
}
