"use client";

import { useMemo, useState } from "react";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";
import { InspectorPanel } from "@/app/dashboard/_components/inspector/InspectorPanel";
import { useInspectorState } from "@/app/dashboard/_components/inspector/useInspectorState";
import { VideoGrid } from "./VideoGrid";
import { InsightInspectorBody } from "./InsightInspectorBody";

const PER_PAGE = 12;
const ALL = "__ALL__";

type Props = {
  videos: InsightVideoRow[];
  title?: string;
};

export function VideoGridSection({ videos, title = "인사이트" }: Props) {
  const inspector = useInspectorState<InsightVideoRow>();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState<string>(ALL);

  const keywordCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of videos) {
      m.set(v.keyword, (m.get(v.keyword) ?? 0) + 1);
    }
    return m;
  }, [videos]);

  const keywordOptions = useMemo(
    () => Array.from(keywordCounts.keys()).sort(),
    [keywordCounts],
  );

  const filtered = useMemo(
    () => (keyword === ALL ? videos : videos.filter((v) => v.keyword === keyword)),
    [videos, keyword],
  );

  const open = inspector.selected !== null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const visible = filtered.slice(start, start + PER_PAGE);
  const showPagination = totalPages > 1;

  const handleKeywordChange = (next: string) => {
    setKeyword(next);
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
          {keywordOptions.length > 0 && (
            <nav
              aria-label="키워드 필터"
              className="flex flex-wrap items-center gap-1"
            >
              <FilterButton
                active={keyword === ALL}
                label={`전체 (${videos.length})`}
                onClick={() => handleKeywordChange(ALL)}
              />
              {keywordOptions.map((kw) => (
                <FilterButton
                  key={kw}
                  active={keyword === kw}
                  label={`${kw} (${keywordCounts.get(kw) ?? 0})`}
                  onClick={() => handleKeywordChange(kw)}
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
              className="rounded-md border border-line bg-cream px-3 py-1.5 text-ink transition-opacity hover:bg-washi-raised disabled:opacity-40"
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
              className="rounded-md border border-line bg-cream px-3 py-1.5 text-ink transition-opacity hover:bg-washi-raised disabled:opacity-40"
            >
              다음 →
            </button>
          </nav>
        )}
      </div>
      <InspectorPanel open={open} onClose={inspector.close}>
        <InsightInspectorBody video={inspector.selected} />
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
      className={`rounded-md border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-vermilion bg-vermilion text-cream"
          : "border-line bg-cream text-ink hover:bg-washi-raised"
      }`}
    >
      {label}
    </button>
  );
}
