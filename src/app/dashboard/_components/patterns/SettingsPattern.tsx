"use client";

import { useState } from "react";

export type SettingsField =
  | { type: "select"; label: string; value: string; options: string[] }
  | { type: "radio"; label: string; value: string; options: string[] }
  | { type: "toggle"; label: string; value: boolean };

export type SettingsSection = {
  id: string;
  label: string;
  fields: SettingsField[];
};

export function SettingsPattern({
  title,
  data,
}: {
  title: string;
  data: { sections: SettingsSection[] };
}) {
  const [activeId, setActiveId] = useState(data.sections[0]?.id ?? "");
  const active = data.sections.find((s) => s.id === activeId) ?? data.sections[0];

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영부</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">{title}</strong>
      </nav>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mb-5 text-xs text-muted">Demo · 변경사항 적용 안 됨</p>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        {/* 좌 nav */}
        <nav className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pb-3 max-md:pr-0">
          {data.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              aria-pressed={s.id === activeId}
              className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
                s.id === activeId
                  ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                  : "border-transparent text-ink hover:bg-line-soft"
              }`}
            >
              <span className="text-xs">
                {s.id === activeId ? "◉" : "·"}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* 우 form */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">{active?.label} 설정</h3>
          {active?.fields.map((field, i) => (
            <SettingsFieldRow key={i} field={field} />
          ))}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled
              className="cursor-not-allowed border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream opacity-60"
              title="Demo · 실제 저장 안 됨"
            >
              저장
            </button>
            <button
              type="button"
              className="cursor-pointer border border-line bg-transparent px-5 py-2 text-sm tracking-[0.04em] text-ink hover:border-vermilion hover:text-vermilion"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsFieldRow({ field }: { field: SettingsField }) {
  if (field.type === "select") {
    return (
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
        <label className="text-sm text-muted">{field.label}</label>
        <select
          defaultValue={field.value}
          className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
        <label className="text-sm text-muted">{field.label}</label>
        <div className="flex gap-4">
          {field.options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.label}
                defaultChecked={opt === field.value}
                className="h-3.5 w-3.5 cursor-pointer"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  // toggle
  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
      <label className="text-sm text-muted">{field.label}</label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          defaultChecked={field.value}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        <span className="text-sm">{field.value ? "켬" : "꺼짐"}</span>
      </label>
    </div>
  );
}
