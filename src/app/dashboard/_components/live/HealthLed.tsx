type Variant = "green" | "vermilion" | "amber";

const COLOR: Record<Variant, string> = {
  green: "bg-green-light",
  vermilion: "bg-vermilion",
  amber: "bg-amber",
};

const GLOW: Record<Variant, string> = {
  green: "shadow-[0_0_4px_var(--green-light)]",
  vermilion: "shadow-[0_0_8px_var(--vermilion),0_0_2px_var(--vermilion)]",
  amber: "shadow-[0_0_4px_var(--amber)]",
};

type Props = { variant: Variant; flicker?: boolean };

/** 헬스 LED 인디케이터 — 10px round + 도메인 색 + 항상 부드럽게 깜박이는 pulse + glow.
 *  flicker=true 시 led-pulse 대신 더 강한 led-flicker (긴급/작동 중 표시). */
export function HealthLed({ variant, flicker = false }: Props) {
  const anim = flicker
    ? "animate-[led-flicker_1s_alternate_infinite]"
    : "animate-[led-pulse_1.6s_ease-in-out_infinite]";
  return (
    <span
      data-health-led
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR[variant]} ${GLOW[variant]} ${anim}`}
    />
  );
}
