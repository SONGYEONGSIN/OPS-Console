"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SbSection } from "../_data";
import { findSidebarLabel } from "../_data/sidebar-helpers";

type Props = {
  sections: SbSection[];
};

const BASE_TITLE = "운영부 상황실";

/**
 * 브라우저 탭 타이틀을 '운영부 상황실 - {메뉴명}'으로 동기화.
 * dashboard layout에 한 번만 mount, usePathname 변경마다 갱신.
 * 매칭되는 메뉴가 없으면(대시보드 루트·미등록 slug) base 타이틀만 표시.
 */
export function DocumentTitle({ sections }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    const slug = pathname.startsWith("/dashboard/")
      ? (pathname.replace("/dashboard/", "").split("/")[0] ?? "")
      : "";
    const label = slug ? findSidebarLabel(sections, slug) : "";
    document.title =
      label && label !== slug ? `${BASE_TITLE} - ${label}` : BASE_TITLE;
  }, [pathname, sections]);

  return null;
}
