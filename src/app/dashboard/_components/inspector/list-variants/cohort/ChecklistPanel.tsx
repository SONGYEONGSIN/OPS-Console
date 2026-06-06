"use client";

import { useMemo, useState, useTransition } from "react";
import { onboardingGuideSections } from "@/app/dashboard/onboarding/_content";
import type { ChecklistToggleInput } from "../types";

type Props = {
  cohortId: string;
  /** 초기 체크 상태 — key 형식: `${section.title}::${item.title}` */
  initialChecks: Record<string, boolean>;
  /** trainee 본인 || admin만 true. false면 읽기 전용. */
  canToggle: boolean;
  onToggle?: (
    input: ChecklistToggleInput,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const keyOf = (sectionTitle: string, itemTitle: string) =>
  `${sectionTitle}::${itemTitle}`;

/**
 * 회차(=신입) 인스펙터 내 온보딩 체크리스트.
 * 항목 정의는 정적(onboardingGuideSections), 체크 상태는 cohort_id 기준.
 * 토글은 낙관적 반영 후 실패 시 롤백.
 */
export function CohortChecklistPanel({
  cohortId,
  initialChecks,
  canToggle,
  onToggle,
}: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>(initialChecks);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { totalCount, checkedCount, percent } = useMemo(() => {
    const total = onboardingGuideSections.reduce(
      (sum, s) => sum + s.items.length,
      0,
    );
    const checked = onboardingGuideSections.reduce(
      (sum, s) =>
        sum +
        s.items.filter((it) => checks[keyOf(s.title, it.title)] === true)
          .length,
      0,
    );
    return {
      totalCount: total,
      checkedCount: checked,
      percent: total === 0 ? 0 : Math.round((checked / total) * 100),
    };
  }, [checks]);

  const handleToggle = (
    sectionTitle: string,
    itemTitle: string,
    nextChecked: boolean,
  ) => {
    if (!onToggle) return;
    setError(null);
    const k = keyOf(sectionTitle, itemTitle);
    setChecks((prev) => ({ ...prev, [k]: nextChecked }));
    startTransition(async () => {
      const r = await onToggle({
        cohort_id: cohortId,
        section_key: sectionTitle,
        item_key: itemTitle,
        checked: nextChecked,
      });
      if (!r.ok) {
        setChecks((prev) => ({ ...prev, [k]: !nextChecked }));
        setError(r.error ?? "토글 실패");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="border border-line-soft bg-washi-raised p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-xs font-bold text-muted">진행도</p>
          <p className="text-sm text-muted">
            <span className="font-bold text-vermilion">
              {checkedCount} / {totalCount}
            </span>
            <span className="ml-1.5 text-xs">({percent}%)</span>
          </p>
        </div>
        <div aria-hidden className="h-1.5 w-full overflow-hidden bg-cream">
          <div
            className="h-full bg-vermilion transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {!canToggle && (
          <p className="mt-2 text-xs text-muted">읽기 전용</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-vermilion">
            {error}
          </p>
        )}
      </div>

      {onboardingGuideSections.map((section) => (
        <div key={section.title}>
          <header className="mb-2 flex items-baseline gap-1.5">
            <span aria-hidden className="text-sm text-vermilion">
              {section.ico}
            </span>
            <h4 className="text-sm font-bold text-ink">{section.title}</h4>
          </header>
          <ul className="space-y-1.5">
            {section.items.map((item) => {
              const k = keyOf(section.title, item.title);
              const checked = checks[k] === true;
              return (
                <li
                  key={k}
                  className="flex items-start gap-2 border-l border-line-soft pl-2"
                >
                  <input
                    type="checkbox"
                    aria-label={item.title}
                    checked={checked}
                    disabled={!canToggle || isPending}
                    onChange={(e) =>
                      handleToggle(section.title, item.title, e.target.checked)
                    }
                    className="mt-0.5 size-3.5 accent-vermilion"
                  />
                  <div className="flex-1">
                    <p
                      className={`text-xs font-medium ${
                        checked ? "text-muted line-through" : "text-ink"
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="mt-0.5 text-2xs text-muted">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
