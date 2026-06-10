import { LiveIndicator } from "./LiveIndicator";
import { SegmentToggle } from "./SegmentToggle";

/**
 * LivePageHeader — 실시간 현황 페이지 헤더.
 * 22px extrabold 타이틀 + LIVE MONITOR 박스 인디케이터 + 세그먼트 토글(전체/내업무).
 * border-b-2 border-ink 강조 (예전 short accent 라인 제거).
 */
export function LivePageHeader({
  mine,
  title,
}: {
  mine: boolean;
  title: string;
}) {
  return (
    <header className="border-b-2 border-ink bg-paper px-6 pb-3 pt-4">
      {/* 내부 wrapper: content max-w-[1680px]와 라인 일치 (와이드 뷰에서 우측 정렬 맞춤) */}
      <div className="mx-auto flex max-w-[1680px] items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-ink">
            {title}
          </h1>
          <LiveIndicator />
        </div>
        <SegmentToggle mine={mine} />
      </div>
    </header>
  );
}
