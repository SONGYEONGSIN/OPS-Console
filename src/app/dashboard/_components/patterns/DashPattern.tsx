"use client";

import { useState } from "react";

export type DashWidget = {
  id: string;
  tone: "urgent" | "ok" | "review";
  label: string;
  value: string;
  time: string;
};

const TONE_BG: Record<DashWidget["tone"], string> = {
  urgent: "border-vermilion bg-vermilion/10",
  ok: "border-sage bg-sage/10",
  review: "border-gold bg-gold/10",
};

const TONE_TEXT: Record<DashWidget["tone"], string> = {
  urgent: "text-vermilion",
  ok: "text-sage",
  review: "text-gold",
};

export function DashPattern({
  title,
  data,
}: {
  title: string;
  data: { widgets: DashWidget[] };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.widgets.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
      <section className="min-h-0 overflow-y-auto p-5 md:p-6 lg:p-7">
        <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">{title}</strong>
        </nav>
        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
          {title} · {data.widgets.length}건
        </h2>
        <p className="mb-5 text-xs text-muted">Demo · 실제 데이터 미연결</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.widgets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedId(w.id)}
              aria-pressed={w.id === selectedId}
              className={`group flex flex-col gap-2 border-2 p-4 text-left transition-colors ${TONE_BG[w.tone]} ${
                w.id === selectedId ? "ring-2 ring-ink ring-offset-2" : ""
              }`}
            >
              <div className={`text-xs font-medium uppercase tracking-[0.08em] ${TONE_TEXT[w.tone]}`}>
                {w.tone === "urgent" ? "긴급" : w.tone === "ok" ? "정상" : "점검"}
              </div>
              <div className="text-md font-semibold text-ink">{w.label}</div>
              <div className="text-2xl font-semibold tracking-[-0.02em] text-ink">{w.value}</div>
              <div className="text-xs text-muted">{w.time}</div>
            </button>
          ))}
        </div>
      </section>

      <aside className="hidden border-l border-line bg-washi-raised lg:block">
        <div className="p-5 lg:p-6">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-muted">
            {selected ? "위젯 상세" : "전체 요약"}
          </h3>
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted">ID</div>
                <div className="font-mono text-sm">{selected.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted">분류</div>
                <span className={`inline-block px-2 py-0.5 text-xs ${TONE_BG[selected.tone]} ${TONE_TEXT[selected.tone]}`}>
                  {selected.tone === "urgent" ? "긴급" : selected.tone === "ok" ? "정상" : "점검"}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">라벨</div>
                <div className="text-md font-semibold">{selected.label}</div>
              </div>
              <div>
                <div className="text-xs text-muted">값</div>
                <div className="text-2xl font-semibold">{selected.value}</div>
              </div>
              <div>
                <div className="text-xs text-muted">시간</div>
                <div className="text-sm text-ink-soft">{selected.time}</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted">위젯을 선택하면 상세 정보를 확인할 수 있습니다.</p>
              <hr className="border-line-soft" />
              <div>
                <div className="text-xs text-muted">총 위젯</div>
                <div className="text-2xl font-semibold">{data.widgets.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted">긴급</div>
                <div className="text-md font-semibold text-vermilion">
                  {data.widgets.filter((w) => w.tone === "urgent").length}건
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
