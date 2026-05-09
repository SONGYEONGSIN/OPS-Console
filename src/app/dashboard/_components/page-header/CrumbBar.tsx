import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (mockup .crumb-bar 매칭).
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * 좌측: breadcrumb / 우측: 동적 다중 탭(PageTabs).
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line-soft bg-washi-raised px-7 pt-2.5">
      <Breadcrumb pathname={pathname} />
      <PageTabs pathname={pathname} />
    </div>
  );
}
