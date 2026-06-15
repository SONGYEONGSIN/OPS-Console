import type { ReactNode } from "react";

/**
 * NOW 마커 러너 캐릭터 레지스트리.
 * 각 캐릭터는 24×24 viewBox 기준 SVG 노드 — 몸통은 `fill="currentColor"`(=vermilion 토큰),
 * 눈은 `className="eye"`(globals.css에서 `var(--paper)`)로 칠한다. 하드코딩 색상 없음.
 * ActivityTimeline이 날짜 시드로 하루 한 종을 선택(데일리 로테이션)한다.
 */
export type NowCharacter = { id: string; label: string; node: ReactNode };

export const NOW_CHARACTERS: NowCharacter[] = [
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
        <path
          fill="currentColor"
          d="M12 2.5 20.5 12 12 21.5 3.5 12Z"
        />
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
