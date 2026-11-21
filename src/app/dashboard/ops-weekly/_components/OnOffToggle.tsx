"use client";

type Props = {
  /** 그룹의 접근성 이름 — 행마다 하나씩이라 '이름 + 칸' 으로 가른다 */
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** 켜진 것을 끌 수 없는 칸(당번 — 비우는 action 이 없다) */
  lockOff?: boolean;
};

const SEG =
  "cursor-pointer px-3 py-1 text-xs transition-colors disabled:cursor-default min-h-9 lg:min-h-0";
const segClass = (active: boolean) =>
  `${SEG} ${active ? "bg-ink text-cream" : "bg-transparent text-ink hover:text-vermilion disabled:text-muted disabled:hover:text-muted"}`;

/** 관리 탭의 사람별 켜고 끄기 — 자동화 메뉴의 ON | OFF 와 같은 모양. */
export function OnOffToggle({ label, on, onChange, disabled, lockOff }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center border border-line"
    >
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled === true || on}
        className={segClass(on)}
        onClick={() => {
          onChange(true);
        }}
      >
        ON
      </button>
      <button
        type="button"
        aria-pressed={!on}
        disabled={disabled === true || !on || lockOff === true}
        className={`border-l border-line ${segClass(!on)}`}
        onClick={() => {
          onChange(false);
        }}
      >
        OFF
      </button>
    </div>
  );
}
