import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (탭만 노출).
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * Breadcrumb 컴포넌트는 사이드바 경로 + PageHeader 제목과 중복이라 제거.
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-11 items-stretch border-b border-line-soft bg-washi-raised px-7">
      <PageTabs pathname={pathname} />
    </div>
  );
}
