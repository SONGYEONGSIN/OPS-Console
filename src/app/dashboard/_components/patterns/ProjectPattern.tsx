"use client";

import { useState } from "react";
import type { ProjectMockData } from "../../_data/patterns";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorImprovementBody } from "../inspector/InspectorImprovementBody";
import { useInspectorState } from "../inspector/useInspectorState";

export type ProjectImprovement = ProjectMockData["improvements"][number];

const STATUS_LABEL: Record<ProjectMockData["improvements"][number]["status"], string> = {
  run: "진행",
  rev: "검토",
  wait: "대기",
};

const STATUS_COLOR: Record<ProjectMockData["improvements"][number]["status"], string> = {
  run: "bg-gold/20 text-gold",
  rev: "bg-sage/20 text-sage",
  wait: "bg-line-soft text-muted",
};

type Tab = "detail" | "improvements" | "activities";

export function ProjectPattern({
  title,
  data,
  header,
}: {
  title: string;
  data: ProjectMockData;
  header?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("detail");
  const [improvements, setImprovements] = useState(data.improvements);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const inspector = useInspectorState<ProjectImprovement>();
  const improvementCount = improvements.length;

  return (
    <>
      {header}
      <div
        className={`flex h-full min-h-0 flex-col transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          inspector.selected !== null ? "md:pr-[340px]" : ""
        }`}
      >
        <section className="flex flex-1 min-h-0 flex-col bg-paper">
        <header className="flex items-center justify-between border-b border-line bg-washi-raised px-5 py-4 lg:px-7">
          <div className="flex items-baseline gap-4">
            <h2 className="text-lg font-semibold text-ink lg:text-xl">{title}</h2>
            <span className="text-xs text-muted">
              담당 {data.meta.manager} · {data.meta.status}
            </span>
          </div>
          <span className="rounded bg-sage/20 px-3 py-1 text-xs text-sage">
            {data.meta.quarterTarget}
          </span>
        </header>

        <nav role="tablist" className="flex border-b border-line bg-washi px-5 lg:px-7">
          <TabButton active={tab === "detail"} onClick={() => setTab("detail")}>
            상세
          </TabButton>
          <TabButton active={tab === "improvements"} onClick={() => setTab("improvements")}>
            개선사항{" "}
            <span className="ml-1 rounded bg-vermilion/15 px-2 text-[10px] text-vermilion">
              {improvementCount}
            </span>
          </TabButton>
          <TabButton active={tab === "activities"} onClick={() => setTab("activities")}>
            활동 로그
          </TabButton>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          {tab === "detail" && <DetailPanel data={data} />}
          {tab === "improvements" && (
            <ImprovementsPanel
              improvements={improvements}
              selectedIndex={selectedIndex}
              onSelect={(i, improvement) => {
                setSelectedIndex(i);
                inspector.open(improvement);
              }}
            />
          )}
          {tab === "activities" && <ActivitiesPanel data={data} />}
        </div>
        </section>
      </div>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={() => {
          setSelectedIndex(null);
          inspector.close();
        }}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 개선 항목
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                {inspector.selected.title}
              </h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 cursor-pointer text-xs text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorImprovementBody
              improvement={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                if (selectedIndex === null) return;
                setImprovements((prev) =>
                  prev.map((imp, i) => (i === selectedIndex ? next : imp)),
                );
                setSelectedIndex(null);
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-3 text-sm transition ${
        active
          ? "border-b-2 border-vermilion font-semibold text-vermilion"
          : "border-b-2 border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function DetailPanel({ data }: { data: ProjectMockData }) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[120px_1fr] lg:gap-x-4 lg:gap-y-2">
      {data.attributes.map((a) => (
        <div key={a.k} className="contents">
          <span className="text-xs text-muted lg:text-sm">{a.k}</span>
          <span className="text-sm text-ink">{a.v}</span>
        </div>
      ))}
    </div>
  );
}

function ImprovementsPanel({
  improvements,
  selectedIndex,
  onSelect,
}: {
  improvements: ProjectImprovement[];
  selectedIndex: number | null;
  onSelect: (index: number, improvement: ProjectImprovement) => void;
}) {
  if (improvements.length === 0) {
    return <p className="text-sm text-muted">진행 중인 개선과제가 없습니다.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {improvements.map((im, i) => (
        <li
          key={`${im.title}-${i}`}
          onClick={() => onSelect(i, im)}
          className={`flex cursor-pointer items-center gap-3 py-3 hover:bg-washi-raised ${
            selectedIndex === i ? "bg-vermilion/10" : ""
          }`}
        >
          <span className="flex-1 text-sm text-ink">{im.title}</span>
          <span className="text-xs text-muted">{im.pm}</span>
          <span className="text-xs text-muted">{im.due}</span>
          <span className={`rounded px-2 py-0.5 text-[10px] ${STATUS_COLOR[im.status]}`}>
            {STATUS_LABEL[im.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivitiesPanel({ data }: { data: ProjectMockData }) {
  return (
    <ul className="space-y-2 font-mono text-xs text-muted">
      {data.activities.map((a, i) => (
        <li key={`${a.time}-${i}`}>
          <span className="text-ink">{a.time}</span> {a.who} — {a.act}
        </li>
      ))}
    </ul>
  );
}
