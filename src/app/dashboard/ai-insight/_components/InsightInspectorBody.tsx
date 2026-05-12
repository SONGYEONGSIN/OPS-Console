"use client";

import type { InsightVideoRow } from "@/features/insight-videos/schemas";

type Props = {
  video: InsightVideoRow | null;
};

export function InsightInspectorBody({ video }: Props) {
  if (!video) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-washi">
        <iframe
          src={`https://www.youtube.com/embed/${video.video_id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink leading-snug">{video.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{video.channel_title}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(video.published_at)}</span>
          <span
            aria-label="키워드"
            className="ml-auto inline-flex items-center rounded-full border border-line bg-washi-raised px-2 py-0.5 text-xs text-ink"
          >
            {video.keyword}
          </span>
        </div>
      </div>

      {video.description ? (
        <section className="rounded-lg border border-line bg-washi-raised p-3">
          <h3 className="mb-1 text-xs font-semibold text-muted">요약</h3>
          <p className="min-h-48 max-h-96 overflow-y-auto pr-1 text-sm leading-relaxed text-ink whitespace-pre-wrap">
            {video.description}
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-line-soft bg-washi p-3 text-xs text-muted">
          영상 설명이 없습니다. 임베드 플레이어를 확인하세요.
        </section>
      )}

      <a
        href={`https://www.youtube.com/watch?v=${video.video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md border border-vermilion bg-vermilion px-3 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90"
      >
        YouTube에서 열기 →
      </a>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
