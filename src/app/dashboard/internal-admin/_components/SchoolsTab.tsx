"use client";

import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import { DOC_KINDS, type School } from "@/features/sms-sender/types";
import {
  STAGE_OPTIONS,
  stageLabel,
  type GubunCard,
  type SchoolDetail,
  type SchoolFilters,
} from "@/features/sms-sender/filters";
import { useDebouncedSearch, useSetParams } from "./use-set-params";
import { SchoolInspector } from "./SchoolInspector";

const DOCS_OPTIONS = ["완비", "미비", "확인 안 됨"] as const;
const TH = "px-3 py-2 font-normal";

function GubunCards({
  cards,
  selected,
}: {
  cards: GubunCard[];
  selected: string;
}) {
  const setParams = useSetParams();
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => {
        const on = c.gubun === selected;
        return (
          <button
            key={c.gubun}
            type="button"
            aria-pressed={on}
            onClick={() => setParams({ gubun: on ? null : c.gubun })}
            className={`border p-4 text-left transition-colors ${
              on
                ? "border-vermilion bg-vermilion/10"
                : "border-line-soft bg-situation-bg hover:border-ink"
            }`}
          >
            <div className="text-xs text-muted">{c.gubun}</div>
            <div className="text-2xl font-bold tabular-nums">{c.schools}곳</div>
            <div className="mt-1 text-xs tabular-nums text-muted">
              {`회선 ${c.lines} · 서류 미비 ${c.deficient} · 확인 ${c.checks}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DocDots({ docs }: { docs: School["docs"] }) {
  if (!docs) return <span className="text-muted">-</span>;
  return (
    <span className="inline-flex gap-1">
      {DOC_KINDS.map((k) => {
        const mark = docs.marks[k];
        const cls =
          mark === "O"
            ? "text-ink"
            : mark === "✕"
              ? "text-vermilion"
              : "text-muted";
        return (
          <span key={k} aria-label={`${k} ${mark || "없음"}`} className={cls}>
            {mark === "O" || mark === "✕" ? mark : mark ? "대" : "·"}
          </span>
        );
      })}
    </span>
  );
}

function SchoolRow({
  school,
  selected,
  onSelect,
}: {
  school: School;
  selected: boolean;
  onSelect: () => void;
}) {
  const top = school.pdfs[0];
  return (
    <tr
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
        selected ? "bg-vermilion/10 text-vermilion" : ""
      }`}
    >
      <td className="px-3 py-2">{school.name}</td>
      <td className="px-3 py-2">{school.gubun}</td>
      <td className="px-3 py-2">{stageLabel(school)}</td>
      <td className="px-3 py-2 tabular-nums">{school.lines}</td>
      <td className="px-3 py-2">
        <DocDots docs={school.docs} />
      </td>
      <td className="px-3 py-2">{school.needsCheck ? "확인" : ""}</td>
      <td className="px-3 py-2">
        {top ? (
          <a
            href={top.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline"
          >
            PDF 열기
          </a>
        ) : (
          <span className="text-muted">PDF 없음</span>
        )}
      </td>
    </tr>
  );
}

export function SchoolsTab({
  cards,
  schools,
  filters,
  detail,
}: {
  cards: GubunCard[];
  schools: School[];
  filters: SchoolFilters;
  detail: SchoolDetail | null;
}) {
  const setParams = useSetParams();
  const [q, setQ] = useDebouncedSearch("q");
  return (
    <div>
      <GubunCards cards={cards} selected={filters.gubun} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListSearch value={q} onChange={setQ} placeholder="학교명 검색" />
        <ListSelect
          value={filters.stage}
          onChange={(v) => setParams({ stage: v || null })}
          options={STAGE_OPTIONS}
          placeholder="단계 전체"
          ariaLabel="단계 필터"
        />
        <ListSelect
          value={filters.docs}
          onChange={(v) => setParams({ docs: v || null })}
          options={DOCS_OPTIONS}
          placeholder="서류 전체"
          ariaLabel="서류 필터"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={filters.checkOnly}
            onChange={(e) =>
              setParams({ check: e.target.checked ? "1" : null })
            }
          />
          확인 필요만
        </label>
      </div>
      {schools.length === 0 ? (
        <p className="bg-situation-bg px-3 py-8 text-center text-sm text-muted">
          조건에 맞는 학교가 없습니다
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              {["학교명", "구분", "단계", "회선", "서류", "확인", "PDF"].map(
                (h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <SchoolRow
                key={s.no}
                school={s}
                selected={filters.school === s.no}
                onSelect={() => setParams({ school: String(s.no) })}
              />
            ))}
          </tbody>
        </table>
      )}
      <SchoolInspector
        detail={detail}
        onClose={() => setParams({ school: null })}
      />
    </div>
  );
}
