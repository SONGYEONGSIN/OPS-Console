"use client";

import dynamic from "next/dynamic";

/**
 * PageTabs를 SSR에서 제외 — OpenTabsProvider의 `useState(loadInitial)`가
 * SSR=[] / CSR=storage 값으로 갈라져 hydration mismatch 유발. ssr:false 로 wrap하면
 * 클라이언트에서만 render되어 mismatch 0.
 *
 * 대안 (react-compiler 룰 위반): useState([]) + useEffect(setX(...)) 패턴은
 * "Calling setState synchronously within an effect"로 차단됨.
 * 이 wrapper가 가장 surgical한 fix (코드 변경 최소).
 */
const PageTabsLazy = dynamic(
  () => import("./PageTabs").then((m) => ({ default: m.PageTabs })),
  { ssr: false },
);

export function PageTabsClient({ pathname }: { pathname: string }) {
  return <PageTabsLazy pathname={pathname} />;
}
