"use client";

import { useState } from "react";

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

export function ListPattern({
  title,
  data,
}: {
  title: string;
  data: { rows: ListRow[] };
}) {
  const [filter, setFilter] = useState<"all" | ListRow["status"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(data.rows[0]?.id ?? null);

  const filtered =
    filter === "all" ? data.rows : data.rows.filter((r) => r.status === filter);

  const selected = data.rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
      {/* 좌: Content */}
      <section className="min-h-0 overflow-y-auto p-5 md:p-6 lg:p-7">
        <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">{title}</strong>
        </nav>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            {title} · {data.rows.length}건
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted">Demo · 실제 데이터 미연결</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "urgent", "active", "review", "approved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`border px-3 py-1 text-xs tracking-[0.04em] transition-colors ${
                filter === f
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
              }`}
            >
              {f === "all" ? "전체" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead className="bg-washi-raised text-xs tracking-[0.06em] text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium uppercase">ID</th>
                <th className="px-3 py-2 text-left font-medium uppercase">이름</th>
                <th className="px-3 py-2 text-left font-medium uppercase">상태</th>
                <th className="px-3 py-2 text-left font-medium uppercase">담당</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    aria-pressed={row.id === selectedId}
                    className={`cursor-pointer border-t border-line transition-colors ${
                      row.id === selectedId ? "bg-vermilion/10" : "hover:bg-line-soft"
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
      </section>

      {/* 우: Inspector (lg+ 전용) */}
      <aside className="hidden border-l border-line bg-washi-raised lg:block">
        <div className="p-5 lg:p-6">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-muted">
            상세
          </h3>
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted">ID</div>
                <div className="font-mono text-sm">{selected.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted">이름</div>
                <div className="text-md font-semibold">{selected.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted">상태</div>
                <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">담당</div>
                <div className="text-sm">{selected.owner}</div>
              </div>
              {selected.meta && (
                <div>
                  <div className="text-xs text-muted">메타</div>
                  <div className="text-sm text-ink-soft">{selected.meta}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">행을 선택하세요.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
