"use client";

import { useMemo, useState } from "react";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";
import {
  INSIGHT_CATEGORIES,
  categoryOf,
} from "@/features/insight-videos/categories";
import { InspectorPanel } from "@/app/dashboard/_components/inspector/InspectorPanel";
import { useInspectorState } from "@/app/dashboard/_components/inspector/useInspectorState";
import { VideoGrid } from "./VideoGrid";
import { InsightInspectorBody } from "./InsightInspectorBody";

const PER_PAGE = 12;
const ALL = "__ALL__";

type Props = {
  videos: InsightVideoRow[];
  title?: string;
  canDelete?: boolean;
};

export function VideoGridSection({
  videos,
  title = "인사이트",
  canDelete = false,
}: Props) {
  const inspector = useInspectorState<InsightVideoRow>();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>(ALL);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of videos) {
      const c = categoryOf(v.keyword);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [videos]);

  // 표시 순서는 INSIGHT_CATEGORIES 고정, 영상이 있는 카테고리만 칩으로 노출.
  const categoryOptions = useMemo(
    () => INSIGHT_CATEGORIES.filter((c) => categoryCounts.has(c)),
    [categoryCounts],
  );

  const filtered = useMemo(
    () =>
      category === ALL
        ? videos
        : videos.filter((v) => categoryOf(v.keyword) === category),
    [videos, category],
  );

  const open = inspector.selected !== null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const visible = filtered.slice(start, start + PER_PAGE);
  const showPagination = totalPages > 1;

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    setPage(1);
  };

  return (
    <>
      <div
        className={`transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          open ? "md:pr-[340px]" : ""
        }`}
      >
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-sm text-vermilion">{filtered.length}건</span>
          </div>
          {categoryOptions.length > 0 && (
            <nav
              aria-label="카테고리 필터"
              className="flex flex-wrap items-center gap-1"
            >
              <FilterButton
                active={category === ALL}
                label={`전체 (${videos.length})`}
                onClick={() => handleCategoryChange(ALL)}
              />
              {categoryOptions.map((c) => (
                <FilterButton
                  key={c}
                  active={category === c}
                  label={`${c} (${categoryCounts.get(c) ?? 0})`}
                  onClick={() => handleCategoryChange(c)}
                />
              ))}
            </nav>
          )}
        </header>

        <VideoGrid videos={visible} onSelect={inspector.open} />

        {showPagination && (
          <nav
            aria-label="페이지 이동"
            className="mt-6 flex items-center justify-center gap-3 text-sm"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="border border-line bg-cream px-3 py-1.5 text-ink transition-opacity hover:bg-washi-raised disabled:opacity-40"
            >
              ← 이전
            </button>
            <span className="font-mono text-xs text-muted">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="border border-line bg-cream px-3 py-1.5 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-40"
            >
              다음 →
            </button>
          </nav>
        )}
      </div>
      <InspectorPanel open={open} onClose={inspector.close}>
        <InsightInspectorBody
          video={inspector.selected}
          canDelete={canDelete}
          onDeleted={inspector.close}
        />
      </InspectorPanel>
    </>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-vermilion bg-vermilion text-cream"
          : "border-line bg-cream text-ink hover:bg-washi-raised"
      }`}
    >
      {label}
    </button>
  );
}
