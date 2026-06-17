import type { ReactNode } from "react";

/**
 * NOW 마커 러너 캐릭터 레지스트리.
 * 각 캐릭터는 24×24 viewBox 기준 SVG 노드 — 몸통은 `fill="currentColor"`(=vermilion 토큰),
 * 눈은 `className="eye"`(globals.css에서 `var(--paper)`)로 칠한다. 하드코딩 색상 없음.
 * ActivityTimeline이 날짜 시드로 하루 한 종을 선택(데일리 로테이션)한다.
 */
export type NowCharacter = { id: string; label: string; node: ReactNode };

/**
 * 사람 모양(스틱맨) 캐릭터 헬퍼 — 머리(currentColor 원) + 눈 2개(.eye) +
 * currentColor 스트로크 사지(limbs). limbs는 단일 path의 다중 M 서브패스로 포즈 표현.
 */
function person(limbsPath: string): ReactNode {
  return (
    <>
      <circle fill="currentColor" cx="12" cy="5" r="3.3" />
      <circle className="eye" cx="10.9" cy="4.7" r="0.7" />
      <circle className="eye" cx="13.1" cy="4.7" r="0.7" />
      <path
        d={limbsPath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** 사람 모양 웃긴 캐릭터 12종 — 배열 앞쪽 배치(사람부터 적용). */
const HUMAN_CHARACTERS: NowCharacter[] = [
  {
    id: "p-wave",
    label: "인사",
    node: person(
      "M12 8.3 L12 14.5 M12 10.5 L15.5 6.5 M12 11 L8.5 13 M12 14.5 L9 20 M12 14.5 L15 20",
    ),
  },
  {
    id: "p-run",
    label: "달리기",
    node: person(
      "M12 8.3 L12 14 M12 10.8 L8 9.5 M12 10.8 L15.5 12.5 M12 14 L8 19 M12 14 L16 16.5",
    ),
  },
  {
    id: "p-jump",
    label: "점프",
    node: person(
      "M12 9 L12 14 M12 11 L8 7 M12 11 L16 7 M12 14 L8.5 18 M12 14 L15.5 18",
    ),
  },
  {
    id: "p-cheer",
    label: "만세",
    node: person(
      "M12 8.3 L12 15 M12 10.5 L8.5 6.5 M12 10.5 L15.5 6.5 M12 15 L10 20 M12 15 L14 20",
    ),
  },
  {
    id: "p-dance",
    label: "춤",
    node: person(
      "M12 8.3 L12 14.5 M12 10.5 L15.5 7 M12 11 L8.5 13 M12 14.5 L9 19 M12 14.5 L16.5 18.5",
    ),
  },
  {
    id: "p-walk",
    label: "걷기",
    node: person(
      "M12 8.3 L12 14.5 M12 11 L9 13 M12 11 L15 12 M12 14.5 L9.5 20 M12 14.5 L14.5 19",
    ),
  },
  {
    id: "p-shrug",
    label: "어쩌라고",
    node: person(
      "M12 8.3 L12 15 M12 11 L8 9.5 M12 11 L16 9.5 M12 15 L10 20 M12 15 L14 20",
    ),
  },
  {
    id: "p-stretch",
    label: "기지개",
    node: person(
      "M12 8.3 L12 15 M12 10.5 L10.5 5.5 M12 10.5 L13.5 5.5 M12 15 L10.5 20 M12 15 L13.5 20",
    ),
  },
  {
    id: "p-kick",
    label: "발차기",
    node: person(
      "M12 8.3 L12 14.5 M12 11 L8.5 12.5 M12 11 L15.5 12 M12 14.5 L9.5 20 M12 14 L17.5 13.5",
    ),
  },
  {
    id: "p-balance",
    label: "한발서기",
    node: person(
      "M12 8.3 L12 14.5 M12 11 L8.5 9.5 M12 11 L15.5 9.5 M12 14.5 L12 20 M12 14.5 L15.5 17",
    ),
  },
  {
    id: "p-point",
    label: "가리키기",
    node: person(
      "M12 8.3 L12 15 M12 10.8 L16.5 8 M12 11 L8.5 11.5 M12 15 L10 20 M12 15 L14 20",
    ),
  },
  {
    id: "p-sit",
    label: "앉기",
    node: person(
      "M12 8.3 L12 13 M12 10.5 L9 12 M12 10.5 L15 12 M12 13 L9.5 15 L9.5 19 M12 13 L14.5 15 L14.5 19",
    ),
  },
];

export const NOW_CHARACTERS: NowCharacter[] = [
  ...HUMAN_CHARACTERS,
  {
    id: "spark4",
    label: "스파클",
    node: (
      <>
        <path
          fill="currentColor"
          d="M12 1.5c1.1 6.4 4.6 9.9 11 11-6.4 1.1-9.9 4.6-11 11-1.1-6.4-4.6-9.9-11-11 6.4-1.1 9.9-4.6 11-11z"
        />
        <circle className="eye" cx="10.5" cy="11.6" r="0.9" />
        <circle className="eye" cx="13.5" cy="11.6" r="0.9" />
      </>
    ),
  },
  {
    id: "spark6",
    label: "육각 스파클",
    node: (
      <>
        <path
          fill="currentColor"
          d="M12 1 14.1 8.36 21.53 6.5 16.2 12 21.53 17.5 14.1 15.64 12 23 9.9 15.64 2.47 17.5 7.8 12 2.47 6.5 9.9 8.36Z"
        />
        <circle className="eye" cx="10.7" cy="11.6" r="0.8" />
        <circle className="eye" cx="13.3" cy="11.6" r="0.8" />
      </>
    ),
  },
  {
    id: "orb",
    label: "오브",
    node: (
      <>
        <circle fill="currentColor" cx="11.5" cy="13" r="7.5" />
        <path
          fill="currentColor"
          d="M19.5 2.5c.4 2.2 1 2.8 3.2 3.2-2.2.4-2.8 1-3.2 3.2-.4-2.2-1-2.8-3.2-3.2 2.2-.4 2.8-1 3.2-3.2z"
        />
        <circle className="eye" cx="9.8" cy="12.6" r="1" />
        <circle className="eye" cx="13.2" cy="12.6" r="1" />
      </>
    ),
  },
  {
    id: "clover",
    label: "클로버",
    node: (
      <>
        <g fill="currentColor">
          <circle cx="12" cy="7.6" r="4.3" />
          <circle cx="16.4" cy="12" r="4.3" />
          <circle cx="12" cy="16.4" r="4.3" />
          <circle cx="7.6" cy="12" r="4.3" />
          <circle cx="12" cy="12" r="4.6" />
        </g>
        <circle className="eye" cx="10.5" cy="11.6" r="1" />
        <circle className="eye" cx="13.5" cy="11.6" r="1" />
      </>
    ),
  },
  {
    id: "gem",
    label: "젬",
    node: (
      <>
        <path fill="currentColor" d="M12 2.5 20.5 12 12 21.5 3.5 12Z" />
        <circle className="eye" cx="10.6" cy="11.6" r="0.95" />
        <circle className="eye" cx="13.4" cy="11.6" r="0.95" />
      </>
    ),
  },
  {
    id: "drop",
    label: "물방울",
    node: (
      <>
        <path
          fill="currentColor"
          d="M12 2.5c4 6 6.4 9.3 6.4 12.1a6.4 6.4 0 1 1-12.8 0C5.6 11.8 8 8.5 12 2.5z"
        />
        <circle className="eye" cx="10.4" cy="14.4" r="1" />
        <circle className="eye" cx="13.6" cy="14.4" r="1" />
      </>
    ),
  },
  {
    id: "heart",
    label: "하트",
    node: (
      <>
        <path
          fill="currentColor"
          d="M12 20.6C5.6 16.2 3.5 12.1 3.5 8.8 3.5 6 5.6 4.3 8 4.3c1.7 0 3.1.9 4 2.3.9-1.4 2.3-2.3 4-2.3 2.4 0 4.5 1.7 4.5 4.5 0 3.3-2.1 7.4-8.5 11.8z"
        />
        <circle className="eye" cx="10.2" cy="10.4" r="0.95" />
        <circle className="eye" cx="13.8" cy="10.4" r="0.95" />
      </>
    ),
  },
  {
    id: "star5",
    label: "별",
    node: (
      <>
        <path
          fill="currentColor"
          d="M12 2l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.8 6.2 19.6l1.5-6.5-5-4.4 6.6-.6z"
        />
        <circle className="eye" cx="10.5" cy="11.6" r="0.85" />
        <circle className="eye" cx="13.5" cy="11.6" r="0.85" />
      </>
    ),
  },
  {
    id: "moon",
    label: "초승달",
    node: (
      <>
        <path
          fill="currentColor"
          d="M14 3a9 9 0 1 0 4.4 16.9A7.3 7.3 0 0 1 14 3z"
        />
        <circle className="eye" cx="9.4" cy="12" r="1" />
        <circle className="eye" cx="12.4" cy="12" r="1" />
      </>
    ),
  },
  {
    id: "ghost",
    label: "유령",
    node: (
      <>
        <path
          fill="currentColor"
          d="M5.5 12a6.5 6.5 0 0 1 13 0v8l-2.2-1.6-2.1 1.6L12 18.4l-2.2 1.6L7.7 18.4 5.5 20z"
        />
        <circle className="eye" cx="9.9" cy="11.2" r="1" />
        <circle className="eye" cx="14.1" cy="11.2" r="1" />
      </>
    ),
  },
];

/** "YYYY-MM-DD" → 정수 시드(예: 20260614). 데일리 로테이션 기준. */
export function daySeedFromYmd(ymd: string): number {
  return Number(ymd.replace(/-/g, ""));
}

/** 시드 기반 캐릭터 인덱스. 음수/0 카운트 안전. 같은 시드 → 같은 인덱스. */
export function pickNowCharacterIndex(seed: number, count: number): number {
  if (count <= 0) return 0;
  return ((Math.trunc(seed) % count) + count) % count;
}
