import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (한 행).
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * 좌측 breadcrumb + 좌측 탭 (인스펙터 우측 열려도 가려지지 않음).
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-11 items-stretch gap-6 border-b border-line-soft bg-washi-raised px-7">
      <Breadcrumb pathname={pathname} />
      <PageTabs pathname={pathname} />
    </div>
  );
}
