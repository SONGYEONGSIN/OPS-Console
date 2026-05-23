type Props = { message: string; leaving?: boolean };

/**
 * 단일 토스트 박스 — bg-ink + cream text + 좌측 LED dot + 진입/퇴장 애니메이션.
 */
export function Toast({ message, leaving = false }: Props) {
  const anim = leaving
    ? "animate-[toast-out_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]"
    : "animate-[toast-in_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]";

  return (
    <div
      className={`flex items-center gap-2 border border-washi bg-ink px-4 py-2.5 text-xs text-cream shadow-md ${anim}`}
    >
      {/* 일회성: 운영 LED glow 효과 (vermilion 토큰 + box-shadow). */}
      <span
        data-toast-led
        className="h-1.5 w-1.5 rounded-full bg-vermilion shadow-[0_0_8px_var(--vermilion),0_0_2px_var(--vermilion)]"
      />
      <span>{message}</span>
    </div>
  );
}
