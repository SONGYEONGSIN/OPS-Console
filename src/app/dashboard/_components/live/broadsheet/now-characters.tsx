import type { ReactNode } from "react";

/**
 * NOW 마커 러너 캐릭터 레지스트리.
 * 각 캐릭터는 24×24 viewBox 기준 SVG 노드 — 몸통은 `fill="currentColor"`(=vermilion 토큰),
 * 눈은 `className="eye"`(globals.css에서 `var(--paper)`)로 칠한다. 하드코딩 색상 없음.
 * ActivityTimeline이 날짜 시드로 하루 한 종을 선택(데일리 로테이션)한다.
 */
export type NowCharacter = { id: string; label: string; node: ReactNode };

/** KBO 야구모자 캐릭터 — 팀 컬러 캡(크라운+챙+단추) + 크림 이니셜. */
function cap(teamClass: string, letter: string): ReactNode {
  return (
    <>
      <g className={teamClass}>
        <path d="M4.5 14.5C4.5 8 8 4.5 12 4.5C16 4.5 19.5 8 19.5 14.5Z" />
        <path d="M11.5 13.6H21C22.3 13.6 22.3 16.2 21 16.2H11.5Z" />
        <circle cx="12" cy="4.8" r="0.9" />
      </g>
      <text className="cap-letter" x="11.5" y="12.4">
        {letter}
      </text>
    </>
  );
}

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
    id: "baseball",
    label: "야구공",
    node: (
      <>
        <circle fill="currentColor" cx="12" cy="12" r="8" />
        <g className="seam">
          <path d="M6.8 6Q10 12 6.8 18" />
          <path d="M17.2 6Q14 12 17.2 18" />
        </g>
        <circle className="eye" cx="10.4" cy="11" r="1" />
        <circle className="eye" cx="13.6" cy="11" r="1" />
      </>
    ),
  },
  { id: "hanwha", label: "한화 이글스", node: cap("cap-hanwha", "한") },
  { id: "lg", label: "LG 트윈스", node: cap("cap-lg", "엘") },
  { id: "doosan", label: "두산 베어스", node: cap("cap-doosan", "두") },
  { id: "samsung", label: "삼성 라이온즈", node: cap("cap-samsung", "삼") },
  { id: "kia", label: "기아 타이거즈", node: cap("cap-kia", "기") },
  { id: "lotte", label: "롯데 자이언츠", node: cap("cap-lotte", "롯") },
  { id: "ssg", label: "SSG 랜더스", node: cap("cap-ssg", "쓱") },
  { id: "nc", label: "NC 다이노스", node: cap("cap-nc", "엔") },
  { id: "kiwoom", label: "키움 히어로즈", node: cap("cap-kiwoom", "키") },
  { id: "kt", label: "KT 위즈", node: cap("cap-kt", "위") },
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
