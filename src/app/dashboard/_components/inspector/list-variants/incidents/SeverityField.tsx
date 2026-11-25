"use client";

import { useId, useState } from "react";
import {
  SEVERITY_VALUES,
  type IncidentSeverity,
  type SeverityCriteria,
} from "@/features/incidents/schemas";
import { SeverityCriteriaEditor } from "./SeverityCriteriaEditor";

type Props = {
  value: IncidentSeverity | undefined;
  onChange: (v: IncidentSeverity) => void;
  /** 신규 보고일 때만 필수다. 기존 NULL 행은 그대로 저장된다. */
  required: boolean;
  error?: string;
  /** 못 읽었으면 null — 기본 문구 사본을 두지 않는다. */
  criteria: SeverityCriteria | null;
  /** admin 만 기준 문구를 고친다. */
  canEditCriteria: boolean;
  /** 신규 가드에 걸렸을 때 폼이 등급 칸으로 포커스를 옮기는 데 쓴다. */
  selectRef?: React.Ref<HTMLSelectElement>;
};

function isSeverity(v: string): v is IncidentSeverity {
  return (SEVERITY_VALUES as readonly string[]).includes(v);
}

/**
 * `?` 툴팁 — hover·포커스로 열린다. 모양은 live/MetricSubcard 톤이고 다른 점은 둘:
 * 포커스로도 열리고, pointer-events-none 을 빼서 포인터를 툴팁 위로 옮겨도 닫히지 않는다(WCAG 1.4.13).
 * `role="tooltip"` 은 투명 래퍼이고 테두리 상자는 그 안에 있다 — `?` 와의 틈을 margin 이 아니라
 * padding(pt-1.5)으로 두어 틈도 hover 영역에 든다.
 * 위치 기준(relative)은 이 span 이 아니라 머리 줄 div 다 — left-0 이 칸 왼쪽 끝이 되어 좁은 서랍에서
 * 가로로 잘리지 않는다. DOM 상 자식이라 group-hover/group-focus-within 은 그대로 동작한다.
 * CSS 툴팁은 Esc 로 안 닫혀서 `?` 에서 Escape 면 포커스를 푼다.
 */
function CriteriaTooltip({ criteria }: { criteria: SeverityCriteria | null }) {
  const tipId = useId();
  return (
    <span className="group inline-flex">
      <button
        type="button"
        aria-label="사고 등급 기준 보기"
        aria-describedby={tipId}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          // preventDefault 로 '이 Esc 는 썼다'고 표시한다 — InspectorPanel 은 defaultPrevented 면
          // 서랍을 닫지 않는다(ModalShell 과 같은 규약). 안 하면 신규 작성 초안이 사라진다.
          e.preventDefault();
          e.currentTarget.blur();
        }}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center border border-line-soft text-2xs leading-none text-muted hover:border-ink hover:bg-ink hover:text-cream focus:border-ink"
      >
        ?
      </button>
      <div
        role="tooltip"
        id={tipId}
        className="absolute left-0 top-full z-20 hidden w-max max-w-full pt-1.5 group-hover:block group-focus-within:block"
      >
        <div className="max-w-[300px] border border-ink bg-cream px-2.5 py-2 text-[11px] leading-snug text-ink">
          {criteria === null ? (
            "기준을 불러오지 못했습니다."
          ) : (
            <dl className="space-y-1">
              {SEVERITY_VALUES.map((v) => (
                <div key={v}>
                  <dt className="font-semibold">{v}</dt>
                  <dd className="text-ink-soft">{criteria[v] || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </span>
  );
}

/** 톱니 — 레포는 아이콘 라이브러리 없이 인라인 SVG 를 쓴다. 바퀴 + 살 8개. */
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="3" />
      <line x1="8" y1="1" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="15" />
      <line x1="1" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="15" y2="8" />
      <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" />
      <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" />
      <line x1="3.05" y1="12.95" x2="4.46" y2="11.54" />
      <line x1="11.54" y1="4.46" x2="12.95" y2="3.05" />
    </svg>
  );
}

/**
 * 사고 등급 입력칸 — select.
 * 빈 옵션 `등급 선택` 은 값이 비었을 때만 보이고 disabled 라, 설정한 등급을 다시 비우지 못한다.
 * admin 에게는 `?` 바로 옆에 톱니 버튼이 붙어 기준 편집 모달을 연다(기준을 못 읽었으면 숨긴다).
 */
export function SeverityField({
  value,
  onChange,
  required,
  error,
  criteria,
  canEditCriteria,
  selectRef,
}: Props) {
  const [editing, setEditing] = useState(false);
  const errorId = useId();
  return (
    <div className="block text-xs">
      <div className="relative mb-1 flex items-center gap-2 text-muted">
        <span>사고 등급</span>
        {required && <span className="text-faint">(필수)</span>}
        <CriteriaTooltip criteria={criteria} />
        {canEditCriteria && criteria !== null && (
          <button
            type="button"
            aria-label="사고 등급 기준 편집"
            onClick={() => setEditing(true)}
            className="inline-flex h-4 w-4 cursor-pointer items-center justify-center border border-line-soft text-muted hover:border-ink hover:bg-ink hover:text-cream focus:border-ink"
          >
            <GearIcon />
          </button>
        )}
      </div>
      <select
        ref={selectRef}
        aria-label="사고 등급"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={error ? errorId : undefined}
        value={value ?? ""}
        onChange={(e) => {
          if (isSeverity(e.target.value)) onChange(e.target.value);
        }}
        className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
      >
        {!value && (
          <option value="" disabled>
            등급 선택
          </option>
        )}
        {SEVERITY_VALUES.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-2xs text-vermilion">
          {error}
        </p>
      )}
      {editing && criteria !== null && (
        <SeverityCriteriaEditor
          criteria={criteria}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
