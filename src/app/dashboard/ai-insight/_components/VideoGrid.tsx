"use client";

import type { InsightVideoRow } from "@/features/insight-videos/schemas";

type Props = {
  videos: InsightVideoRow[];
  onSelect: (video: InsightVideoRow) => void;
};

export function VideoGrid({ videos, onSelect }: Props) {
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-washi-raised p-10 text-center text-sm text-muted">
        오늘은 신규 수집이 없습니다 — 내일 다시 확인해주세요.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v)}
          className="group flex flex-col overflow-hidden rounded-xl border border-line bg-cream text-left transition-colors hover:border-vermilion focus:border-vermilion focus:outline-none"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-washi">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.thumbnail_url}
              alt={v.title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <h3 className="line-clamp-2 text-sm font-semibold text-ink">{v.title}</h3>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{v.channel_title}</span>
              <span>{formatDate(v.published_at)}</span>
            </div>
            <span className="mt-auto inline-flex w-fit items-center rounded-full border border-line bg-washi-raised px-2 py-0.5 text-xs text-ink">
              {v.keyword}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
