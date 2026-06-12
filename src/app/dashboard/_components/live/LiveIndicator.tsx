/**
 * "● LIVE" 박스 인디케이터.
 * LED dot pulse 애니메이션 (globals.css @keyframes live-pulse).
 * label 기본값은 "LIVE MONITOR" — 호출처에서 "LIVE" 등으로 덮어쓸 수 있다.
 */
export function LiveIndicator({ label = "LIVE MONITOR" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-vermilion bg-vermilion/5 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-vermilion">
      {/* 일회성 애니메이션: 운영 모니터 LED pulse (globals.css @keyframes live-pulse) */}
      <span
        data-live-dot
        className="h-1.5 w-1.5 rounded-full bg-vermilion animate-[live-pulse_1.8s_ease-in-out_infinite]"
      />
      {label}
    </span>
  );
}
