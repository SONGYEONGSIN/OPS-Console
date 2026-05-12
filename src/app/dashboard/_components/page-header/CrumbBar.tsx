import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (mockup .crumb-bar 매칭, 한 행).
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * 좌측: breadcrumb / 우측: 동적 다중 탭(PageTabs).
 * 탭이 많아져도 우측 영역만 가로 스크롤 (min-w-0 + overflow-x-auto).
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-11 items-stretch gap-32 border-b border-line-soft bg-washi-raised px-7">
      <Breadcrumb pathname={pathname} />
      <div className="flex min-w-0 flex-1 justify-end overflow-x-auto">
        <PageTabs pathname={pathname} />
      </div>
    </div>
  );
}
