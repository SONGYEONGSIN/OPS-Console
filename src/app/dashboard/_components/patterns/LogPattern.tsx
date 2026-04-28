"use client";

import { useState } from "react";

export type LogLine = {
  ts: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  msg: string;
};

const LEVEL_COLOR: Record<LogLine["level"], string> = {
  INFO: "text-ink-soft",
  WARN: "text-gold",
  ERROR: "text-vermilion",
  DEBUG: "text-muted",
};

export function LogPattern({
  title,
  data,
}: {
  title: string;
  data: { lines: LogLine[] };
}) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | LogLine["level"]>("all");

  const filtered = data.lines.filter((line) => {
    if (levelFilter !== "all" && line.level !== levelFilter) return false;
    if (query && !line.msg.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영부</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">{title}</strong>
      </nav>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mb-4 text-xs text-muted">Demo · 실제 데이터 미연결</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 min-w-[240px] items-center gap-1.5 border border-line-soft bg-washi-raised px-3 py-2">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted">
            <path
              d="M11 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10.5 10l3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="쿼리 입력…"
            className="flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevelFilter(lv)}
              className={`border px-3 py-1 text-xs tracking-[0.04em] transition-colors ${
                levelFilter === lv
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
              }`}
            >
              {lv === "all" ? "전체" : lv}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-line bg-ink text-cream">
        <pre className="m-0 p-3 text-xs leading-[1.6]">
          {filtered.length === 0 ? (
            <span className="text-muted">로그 결과가 없습니다.</span>
          ) : (
            filtered.map((line, i) => (
              <div key={i} className="font-mono">
                <span className="opacity-60">{line.ts}</span>{" "}
                <span className={`font-semibold ${LEVEL_COLOR[line.level]}`}>[{line.level}]</span>{" "}
                <span>{line.msg}</span>
              </div>
            ))
          )}
        </pre>
      </div>
    </section>
  );
}
