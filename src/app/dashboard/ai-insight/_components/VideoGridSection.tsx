"use client";

import { useState } from "react";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";
import { InspectorPanel } from "@/app/dashboard/_components/inspector/InspectorPanel";
import { useInspectorState } from "@/app/dashboard/_components/inspector/useInspectorState";
import { VideoGrid } from "./VideoGrid";
import { InsightInspectorBody } from "./InsightInspectorBody";

const PER_PAGE = 12;

type Props = {
  videos: InsightVideoRow[];
};

export function VideoGridSection({ videos }: Props) {
  const inspector = useInspectorState<InsightVideoRow>();
  const [page, setPage] = useState(1);

  const open = inspector.selected !== null;
  const totalPages = Math.max(1, Math.ceil(videos.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const visible = videos.slice(start, start + PER_PAGE);
  const showPagination = totalPages > 1;

  return (
    <>
      <div
        className={`transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          open ? "md:pr-[340px]" : ""
        }`}
      >
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
