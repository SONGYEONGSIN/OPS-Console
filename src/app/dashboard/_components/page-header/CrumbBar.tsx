import { Breadcrumb } from "./Breadcrumb";
import { PageTabsClient } from "./PageTabsClient";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (한 행).
 * bg-sidebar(왼쪽 메뉴바와 동일 톤) + border-bottom으로 본문과 시각 분리.
 * 좌측 breadcrumb + 좌측 탭 (인스펙터 우측 열려도 가려지지 않음).
 *
 * PageTabs는 OpenTabsProvider의 localStorage 의존으로 SSR/CSR 차이 → ssr:false dynamic.
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-11 items-stretch gap-6 border-b border-line-soft bg-sidebar px-7">
      <Breadcrumb pathname={pathname} />
      <PageTabsClient pathname={pathname} />
    </div>
  );
}
