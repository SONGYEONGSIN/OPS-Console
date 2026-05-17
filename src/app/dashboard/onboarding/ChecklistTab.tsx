"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GuideSection } from "../_components/patterns/GuidePattern";

export type ChecklistToggleInput = {
  cohort_id: string;
  section_key: string;
  item_key: string;
  checked: boolean;
};

export type ChecklistCohortOption = {
  id: string;
  title: string;
};

type Props = {
  sections: GuideSection[];
  /** 권한별로 필터된 cohort 목록 — admin은 전체, mentor는 본인 mentor cohort, trainee는 본인 cohort */
  cohorts: ChecklistCohortOption[];
  /** 현재 선택된 cohort id. 없으면 안내문 */
  selectedCohortId: string | null;
  /** 초기 체크 상태 — key 형식: `${section.title}::${item.title}` */
  initialChecks: Record<string, boolean>;
  /** selectedCohortId 기준으로 server에서 결정 — trainee 본인 || admin만 true */
  canToggle: boolean;
  onToggle: (input: ChecklistToggleInput) => Promise<{
    ok: boolean;
    error?: string;
  }>;
};

const keyOf = (sectionTitle: string, itemTitle: string) =>
  `${sectionTitle}::${itemTitle}`;

export function ChecklistTab({
  sections,
  cohorts,
  selectedCohortId,
  initialChecks,
  canToggle,
  onToggle,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [checks, setChecks] = useState<Record<string, boolean>>(initialChecks);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { totalCount, checkedCount, percent } = useMemo(() => {
    const total = sections.reduce((sum, s) => sum + s.items.length, 0);
    const checked = sections.reduce(
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
  }, [sections, checks]);

  if (cohorts.length === 0 || !selectedCohortId) {
    return (
      <p className="border border-dashed border-line-soft bg-washi-raised p-8 text-center text-sm text-muted">
        회차가 없습니다. admin이 회차를 생성하면 체크리스트가 활성화됩니다.
      </p>
    );
  }

  const handleCohortChange = (nextId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("cohort", nextId);
    next.set("tab", "checklist");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const handleToggle = (
    sectionTitle: string,
    itemTitle: string,
    nextChecked: boolean,
  ) => {
    setError(null);
    const k = keyOf(sectionTitle, itemTitle);
    setChecks((prev) => ({ ...prev, [k]: nextChecked }));
    startTransition(async () => {
      const r = await onToggle({
        cohort_id: selectedCohortId,
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
    <div className="space-y-6">
      <header className="border border-line-soft bg-washi-raised p-4">
        {cohorts.length > 1 && (
          <div className="mb-3 flex items-center gap-2">
            <label
              htmlFor="checklist-cohort-select"
              className="text-xs font-bold text-muted"
            >
              회차
            </label>
            <select
              id="checklist-cohort-select"
              value={selectedCohortId}
              onChange={(e) => handleCohortChange(e.target.value)}
              className="border border-line bg-transparent px-2 py-1 text-sm text-ink focus:border-vermilion focus:outline-none"
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {!canToggle && (
              <span className="text-xs text-muted">읽기 전용</span>
            )}
          </div>
        )}

        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-ink">진행도</p>
          <p className="text-sm text-muted">
            <span className="font-bold text-vermilion">
              {checkedCount} / {totalCount}
            </span>
            <span className="ml-2 text-xs">({percent}%)</span>
          </p>
        </div>
        <div aria-hidden className="h-1.5 w-full overflow-hidden bg-cream">
          <div
            className="h-full bg-vermilion transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-vermilion">
            {error}
          </p>
        )}
      </header>

      {sections.map((section) => (
        <article
          key={section.title}
          className="border border-line-soft bg-washi-raised p-5"
        >
          <header className="mb-3 flex items-baseline gap-2">
            <span aria-hidden className="text-base text-vermilion">
              {section.ico}
            </span>
            <h3 className="text-base font-bold text-ink">{section.title}</h3>
          </header>
          {section.description && (
            <p className="mb-3 text-sm text-muted">{section.description}</p>
          )}
          <ul className="space-y-2">
            {section.items.map((item) => {
              const k = keyOf(section.title, item.title);
              const checked = checks[k] === true;
              return (
                <li
                  key={k}
                  className="flex items-start gap-3 border-l border-line-soft pl-3"
                >
                  <input
                    type="checkbox"
                    aria-label={item.title}
                    checked={checked}
                    disabled={!canToggle || isPending}
                    onChange={(e) =>
                      handleToggle(section.title, item.title, e.target.checked)
                    }
                    className="mt-1 size-4 accent-vermilion"
                  />
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        checked ? "text-muted line-through" : "text-ink"
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
