"use client";

/**
 * 명보 스프라이트 — 공을 앞에 둔 사람이다(조직 은유가 축구다).
 *
 * 도안이 **두 벌**이다. 한 벌로 두 크기를 감당할 수 없어서다 — 20×20 을 채팅
 * 줄(18px)에 넣으면 칸당 0.9px 라 뭉개지고, 12×12 를 아바타(44px)에 키우면
 * 사람으로 안 읽힌다.
 *
 * `detail` 20×20 — 첫 화면 아바타용. 머리·목·어깨·양팔·다리가 다 산다.
 * `compact` 12×12 — 채팅 이름 앞 마크용. 실루엣만 남기고 최소화.
 *
 * 두 프레임의 차이는 다리 3행뿐 — 공 쪽으로 발을 뻗었다 놓는다. 기다리는 동안
 * 공을 툭툭 건드리는 모양이라, **답을 기다리는 30~40초에만** 움직인다.
 * 평소에도 돌면 긴 답을 읽는 동안 옆에서 계속 움직여 방해가 된다.
 */
const DETAIL_IDLE = [
  "......111111........",
  ".....11111111.......",
  "....1111111111......",
  "....11.1111.11......",
  "....1111111111......",
  ".....11111111.......",
  "......111111........",
  ".......1111.........",
  ".....11111111.......",
  "...11.111111.11.....",
  "...11.111111.11.....",
  "...11.111111.11.....",
  ".....11111111.......",
  ".....111..111.......",
  ".....111..111.......",
  ".....111..111...111.",
  ".....111..111..11111",
  "....1111..111..11111",
  "...11111..1111..111.",
  "....................",
] as const;

/** 발을 공 쪽으로 뻗은 프레임 — 다리 아래쪽만 다르다. */
const DETAIL_KICK = [
  ...DETAIL_IDLE.slice(0, 15),
  ".....111..111...111.",
  ".....111..1111.11111",
  "....1111..1111111111",
  "...11111...1111..111",
  "....................",
] as const;

const SPRITE_IDLE = [
  "001111000000",
  "011111100000",
  "010110100000",
  "001111000000",
  "111111110000",
  "001111000000",
  "001111000000",
  "001100110000",
  "001100110000",
  "011000110000",
  "000000000111",
  "000000000111",
] as const;

/** 발을 공 쪽으로 뻗은 프레임 — IDLE 과 7·8·9행만 다르다. */
const SPRITE_KICK = [
  ...SPRITE_IDLE.slice(0, 7),
  "001111000000",
  "001111110000",
  "011001110000",
  ...SPRITE_IDLE.slice(10),
] as const;

/**
 * 픽셀 도안을 SVG rect 로 그린다.
 *
 * 이미지·GIF 파일이 아닌 이유는 두 가지다. 크기가 달라져도 또렷하고(아바타는
 * 44px, 채팅 줄은 18px), 색이 `currentColor` 라 부모 토큰을 그대로 따른다 —
 * hex 를 박으면 디자인 규칙 위반이고 다크 대응이 끊긴다.
 *
 * 움직임은 두 도안을 겹쳐두고 CSS 로 번갈아 보인다. `motion-reduce` 에서는
 * 정지 프레임만 남는다.
 */
export type SpriteVariant = "detail" | "compact";

export function MyeongboSprite({
  kicking = false,
  variant = "compact",
}: {
  kicking?: boolean;
  variant?: SpriteVariant;
}) {
  const detail = variant === "detail";
  const grid = detail
    ? kicking
      ? DETAIL_KICK
      : DETAIL_IDLE
    : kicking
      ? SPRITE_KICK
      : SPRITE_IDLE;
  const size = detail ? 20 : 12;
  return (
    <svg
      data-myeongbo-sprite
      data-kicking={String(kicking)}
      data-variant={variant}
      viewBox={`0 0 ${size} ${size}`}
      className="h-full w-full"
      fill="currentColor"
      shapeRendering="crispEdges"
    >
      {grid.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "1" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
          ) : null,
        ),
      )}
    </svg>
  );
}

