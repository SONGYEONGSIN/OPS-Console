import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠.
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * 두 행 구조: 위 행 breadcrumb (네비 컨텍스트) / 아래 행 PageTabs (열린 탭).
 * 한 행에 둘을 함께 두면 탭 늘어났을 때 시각 중복·overflow 발생.
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-col border-b border-line-soft bg-washi-raised px-7">
      <div className="flex min-h-9 items-center">
        <Breadcrumb pathname={pathname} />
      </div>
      <div className="flex min-h-11 items-stretch border-t border-line-soft/60">
        <PageTabs pathname={pathname} />
      </div>
    </div>
  );
}
