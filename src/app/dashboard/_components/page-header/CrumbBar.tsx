import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";

/**
 * CrumbBar — 콘텐츠 헤더 상단 띠 (한 행).
 * bg-washi-raised + border-bottom으로 본문과 시각 분리.
 * 좌측 breadcrumb + divider + 좌측 탭 → 인스펙터 패널이 우측 열려도 가려지지 않음.
 * 탭이 많아지면 가로 스크롤로 처리 (min-w-0 + overflow-x-auto).
 */
export function CrumbBar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-11 items-stretch gap-4 border-b border-line-soft bg-washi-raised px-7">
      <Breadcrumb pathname={pathname} />
      <div
        aria-hidden
        className="my-2 w-px shrink-0 bg-line-soft"
      />
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        <PageTabs pathname={pathname} />
      </div>
    </div>
  );
}
