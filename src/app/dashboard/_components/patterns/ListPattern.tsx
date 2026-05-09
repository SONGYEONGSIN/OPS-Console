"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { useInspectorState } from "../inspector/useInspectorState";

export type ListRow = {
  id: string;
  name: string;
  status: "urgent" | "active" | "review" | "approved";
  owner: string;
  meta?: string;
};

const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "긴급",
  active: "활성",
  review: "점검중",
  approved: "정상",
};

const STATUS_COLOR: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
};

type Filter = ListRow["status"] | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "review", label: "점검중" },
  { value: "approved", label: "정상" },
];

type Props = {
  title: string;
  data: { rows: ListRow[] };
  header?: React.ReactNode;
};

export function ListPattern({ title, data, header }: Props) {
  const [rows, setRows] = useState<ListRow[]>(data.rows);
  const [filter, setFilter] = useState<Filter>("all");
  const inspector = useInspectorState<ListRow>();

  const filteredRows =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <>
      <div
        className={`flex flex-col transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          inspector.selected !== null ? "md:pr-[340px]" : ""
        }`}
      >
        {header}
        <section className="p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-sm text-vermilion">
              {filteredRows.length}건
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              const count =
                f.value === "all"
                  ? rows.length
                  : rows.filter((r) => r.status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-label={f.label}
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
                    active
                      ? "font-bold text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {f.label} ({count})
                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">담당</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => inspector.open(row)}
                    className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                      inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted">{row.id}</td>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted">
          Demo · 실제 데이터 미연결
        </p>
        </section>
      </div>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 항목 상세
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">{inspector.selected.name}</h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 cursor-pointer text-xs text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorListBody
              row={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
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
