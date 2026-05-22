"use client";

import type { FeedItem } from "./feed";

type Props = {
  item: FeedItem;
  onSelect: (item: FeedItem) => void;
};

/** 피드 행 — [도메인 칩] · 일자 · 내용. 클릭→onSelect. */
export function FeedRow({ item, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-center gap-3 border-b border-line-soft px-3 py-2 text-left text-sm text-ink hover:bg-washi-raised"
    >
      <span className="inline-flex w-16 justify-center border border-vermilion/40 px-1.5 py-0.5 text-2xs uppercase tracking-[0.06em] text-vermilion">
        {item.domainLabel}
      </span>
      <span className="w-16 text-xs text-ink-soft">{item.dateDisplay}</span>
      <span className="flex-1 truncate">{item.title}</span>
    </button>
  );
}
