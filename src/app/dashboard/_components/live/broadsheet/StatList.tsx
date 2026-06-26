"use client";

import { useState } from "react";
import { HeadlineUrgentModal } from "./HeadlineUrgentModal";

export type StatRow = {
  label: string;
  value: string;
  tone?: "default" | "vermilion" | "sage";
  /** 있으면 행이 클릭 가능 — 모달의 "페이지 이동하기" 대상. */
  href?: string;
  /** 모달에 표시할 상세 리스트(시각·제목·보조 상세). */
  detailRows?: { time?: string; title: string; sub?: string }[];
};

export function StatList({ rows }: { rows: StatRow[] }) {
  const [open, setOpen] = useState<StatRow | null>(null);

  const labelCls = (r: StatRow) =>
    `text-[10px] font-bold uppercase tracking-[0.1em] ${
      r.tone === "vermilion" ? "text-vermilion" : "text-muted"
    }`;
  const valueCls = (r: StatRow) =>
    `text-lg font-bold tabular-nums ${
      r.tone === "vermilion"
        ? "text-vermilion"
        : r.tone === "sage"
          ? "text-sage"
          : "text-ink"
    }`;

  return (
    <div className="flex flex-col border-y border-line divide-y divide-line-soft bg-paper">
      {rows.map((r) =>
        r.href ? (
          <button
            key={r.label}
            type="button"
            onClick={() => setOpen(r)}
            className="flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-washi-raised cursor-pointer"
          >
            <span className={labelCls(r)}>{r.label}</span>
            <span className={valueCls(r)}>{r.value}</span>
          </button>
        ) : (
          <div
            key={r.label}
            className="flex items-center justify-between px-4 py-2.5"
          >
            <span className={labelCls(r)}>{r.label}</span>
            <span className={valueCls(r)}>{r.value}</span>
          </div>
        ),
      )}

      {open && open.href && (
        <HeadlineUrgentModal
          item={{
            label: open.label,
            valueText: open.value,
            href: open.href,
            rows: open.detailRows,
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
