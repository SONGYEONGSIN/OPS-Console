/**
 * 뉴스레터 전용 커스텀 아이콘 — 이모지 대체, '운영부 마법사' 컨셉의 귀여운 라인 아이콘.
 * 단색조(currentColor) — 사용처에서 text-nl-sky 등으로 색을 정한다.
 * 공통: 28px viewBox, 둥근 스트로크, 점 눈 + 미소로 표정 부여.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 28 28",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** 마법사 모자 — 제호 프로필. 별 하나가 콕. */
export function WizardHatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3.5 8.5 17h11L14 3.5Z" />
      <path d="M4.5 20c2.5 1.8 6 2.8 9.5 2.8s7-1 9.5-2.8" />
      <path d="M8.5 17c1.6 1 3.4 1.5 5.5 1.5s3.9-.5 5.5-1.5" />
      <path
        d="m12.2 9.4.7-1.5.7 1.5 1.5.3-1.1 1 .3 1.5-1.4-.8-1.4.8.3-1.5-1.1-1 1.5-.3Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** 두루마리 계약서 — 계약 이야기. */
export function ScrollIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 5.5h11a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 19 22.5H9A2.5 2.5 0 0 1 6.5 20V8" />
      <path d="M8 5.5A2.5 2.5 0 0 0 5.5 8c0 1.4 1.1 2.5 2.5 2.5h1" />
      <path d="M10.5 13h7M10.5 16.5h7M10.5 20h4" />
      <circle cx="12.3" cy="8.6" r="0.65" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="8.6" r="0.65" fill="currentColor" stroke="none" />
      <path d="M12.8 10c.7.5 1.7.5 2.4 0" strokeWidth={1.2} />
    </svg>
  );
}

/** 달력 — 차주 업무. 하트 도장 콕. */
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4.5" y="6" width="19" height="17" rx="3" />
      <path d="M4.5 11h19M9.5 3.5V8M18.5 3.5V8" />
      <path
        d="M14 20.2s-3-1.8-3-3.7c0-1 .8-1.8 1.7-1.8.6 0 1.1.3 1.3.8.2-.5.7-.8 1.3-.8.9 0 1.7.8 1.7 1.8 0 1.9-3 3.7-3 3.7Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** 알람시계 — 마감 이야기. 종종거리는 다리까지. */
export function AlarmIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="14" cy="14" r="8.5" />
      <path d="M14 9.5V14l3 2" />
      <path d="m5.5 5.5 3-2.5M22.5 5.5l-3-2.5M9 22l-1.5 2M19 22l1.5 2" />
    </svg>
  );
}

/** 수정 구슬 — AI 이야기 (마법사의 도구). */
export function CrystalBallIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="14" cy="13" r="8.5" />
      <path d="M9.5 22.5h9l1 2.5h-11l1-2.5Z" />
      <path d="M9.5 10.5c.8-1.8 2.4-3 4.5-3.2" strokeWidth={1.4} />
      <circle cx="11.8" cy="13.5" r="0.65" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="13.5" r="0.65" fill="currentColor" stroke="none" />
      <path d="M12.5 15.5c.9.7 2.1.7 3 0" strokeWidth={1.2} />
    </svg>
  );
}

/** 케이크 — 기념일(생일·근속) 코너. */
export function CakeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 23.5h17v-7a3 3 0 0 0-3-3h-11a3 3 0 0 0-3 3v7Z" />
      <path
        d="M5.5 18.5c1.5 1.3 2.8 1.3 4.3 0s2.8-1.3 4.2 0 2.8 1.3 4.2 0 2.8-1.3 4.3 0"
        strokeWidth={1.4}
      />
      <path d="M14 13.5v-3M14 8.2c-.9 0-1.4-.8-1-1.6L14 4.5l1 2.1c.4.8-.1 1.6-1 1.6Z" />
      <path d="M4 23.5h20" />
    </svg>
  );
}

/** 카메라 — 이번 주 앨범. */
export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="8" width="21" height="15" rx="3" />
      <path d="M10 8l1.5-3h5L18 8" />
      <circle cx="14" cy="15.5" r="4.2" />
      <circle cx="14" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="21" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 필름 클래퍼 — 영상 코너. */
export function ClapperIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="10.5" width="20" height="12.5" rx="2.5" />
      <path d="m4.5 10 18.6-4 .9 4.2-19 4" />
      <path d="m9 9 2.5-3.5M14.5 8l2.5-3.5M20 6.8l2.4-3.3" strokeWidth={1.4} />
      <circle cx="11.5" cy="16.5" r="0.65" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16.5" r="0.65" fill="currentColor" stroke="none" />
      <path d="M12 19c1.2.9 2.8.9 4 0" strokeWidth={1.2} />
    </svg>
  );
}
