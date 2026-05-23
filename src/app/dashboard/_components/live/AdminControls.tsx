"use client";

type Props = {
  sim: boolean;
  onToggleSim: () => void;
  onTestEvent: () => void;
};

/** 관리자 컨트롤 — 시뮬레이션 토글(주) + 테스트 이벤트 인입(보조). */
export function AdminControls({ sim, onToggleSim, onTestEvent }: Props) {
  const mainClass = sim
    ? "w-full cursor-pointer border border-vermilion bg-vermilion px-2 py-2 text-xs font-semibold text-cream transition-colors"
    : "w-full cursor-pointer border border-ink bg-ink px-2 py-2 text-xs font-semibold text-cream transition-colors hover:bg-ink-soft";

  return (
    <div className="border border-ink bg-washi p-3">
      <button type="button" onClick={onToggleSim} className={`${mainClass} mb-2`}>
        {sim ? "시뮬레이션 정지" : "시뮬레이션 활성화"}
      </button>
      <button
        type="button"
        onClick={onTestEvent}
        className="w-full cursor-pointer border border-ink bg-transparent px-2 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-washi-raised"
      >
        테스트 이벤트 인입 (+1)
      </button>
    </div>
  );
}
