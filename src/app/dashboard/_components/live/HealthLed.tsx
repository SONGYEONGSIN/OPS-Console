type Variant = "green" | "vermilion" | "amber";

const COLOR: Record<Variant, string> = {
  green: "bg-green-light",
  vermilion: "bg-vermilion",
  amber: "bg-amber",
};

type Props = { variant: Variant; flicker?: boolean };

/** 헬스 LED 인디케이터 — 8px round + 도메인 색.
 *  flicker=true 시 led-flicker keyframes로 깜빡임 (globals.css). */
export function HealthLed({ variant, flicker = false }: Props) {
  const anim = flicker ? "animate-[led-flicker_1s_alternate_infinite]" : "";
  return (
    <span
      data-health-led
      aria-hidden
      className={`inline-block h-2 w-2 rounded-full ${COLOR[variant]} ${anim}`.trim()}
    />
  );
}
