"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorDashBody } from "../inspector/InspectorDashBody";
import { useInspectorState } from "../inspector/useInspectorState";

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
  const [widgets, setWidgets] = useState<DashWidget[]>(data.widgets);
  const inspector = useInspectorState<DashWidget>();

  return (
    <>
      <section className="min-h-0 overflow-y-auto p-5 md:p-6 lg:p-7">
        <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">{title}</strong>
        </nav>
        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
          {title} · {widgets.length}건
        </h2>
        <p className="mb-5 text-xs text-muted">Demo · 실제 데이터 미연결</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => inspector.open(w)}
              aria-pressed={inspector.selected?.id === w.id}
              className={`group flex flex-col gap-2 border-2 p-4 text-left transition-colors ${TONE_BG[w.tone]} ${
                inspector.selected?.id === w.id ? "ring-2 ring-ink ring-offset-2" : ""
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

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 위젯 상세
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                {inspector.selected.label}
              </h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 cursor-pointer text-xs text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorDashBody
              widget={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                setWidgets((prev) => prev.map((w) => (w.id === next.id ? next : w)));
                inspector.close();
              }}
              onCancel={inspector.toggleEdit}
            />
          </>
        )}
      </InspectorPanel>
    </>
  );
}
