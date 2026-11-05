"use client";

import { KpiCard } from "@/components/common/KpiCard";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import { DOC_KINDS, type School } from "@/features/sms-sender/types";
import {
  STAGE_OPTIONS,
  stageLabel,
  type GubunCard,
  type SchoolFilters,
} from "@/features/sms-sender/filters";
import { useDebouncedSearch, useSetParams } from "./use-set-params";
import { SmsListShell, rowProps, type ListContext } from "./SmsListShell";
import { markClass, markGlyph } from "./doc-mark";

const DOCS_OPTIONS = ["완비", "미비", "확인 안 됨"] as const;
const HEADS = ["학교명", "구분", "단계", "회선", "서류", "확인", "PDF"];

/**
 * 구분별 카드 — 공통 `KpiCard`(운영리포트 기준)를 버튼으로 감싸 누르면 그 구분만 거른다.
 * KpiCard 는 숫자 하나만 그리므로 회선·서류 미비·확인은 카드 아래 한 줄로 둔다.
 * 카드는 면(面)이라 버튼 호버(검정 배경)를 쓰지 않고 테두리만 진하게 한다.
 */
function GubunCards({
  cards,
  selected,
}: {
  cards: GubunCard[];
  selected: string;
}) {
  const setParams = useSetParams();
  return (
    <div className="grid grid-cols-2 gap-3 px-7 pt-3 md:grid-cols-5">
      {cards.map((c) => {
        const on = c.gubun === selected;
        return (
          <button
            key={c.gubun}
            type="button"
            aria-pressed={on}
            onClick={() => setParams({ gubun: on ? null : c.gubun })}
            className={`flex flex-col gap-1 text-left transition-shadow ${
              on ? "ring-2 ring-vermilion" : "hover:ring-1 hover:ring-ink"
            }`}
          >
            <KpiCard
              item={{
                label: c.gubun,
                value: c.schools,
                unit: "곳",
                prevValue: null,
                delta: null,
                deltaPct: null,
                goodOnIncrease: true,
              }}
            />
            <span className="px-1 pb-1 text-xs tabular-nums text-muted">
              {`회선 ${c.lines} · 서류 미비 ${c.deficient} · 확인 ${c.checks}`}
            </span>
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
        return (
          <span
            key={k}
            aria-label={`${k} ${mark || "없음"}`}
            title={mark || undefined}
            className={markClass(mark)}
          >
            {markGlyph(mark)}
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
    <tr {...rowProps({ selected, onSelect })}>
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

function SchoolControls({ filters }: { filters: SchoolFilters }) {
  const setParams = useSetParams();
  const [q, setQ] = useDebouncedSearch("q");
  return (
    <>
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
          onChange={(e) => setParams({ check: e.target.checked ? "1" : null })}
        />
        확인 필요만
      </label>
    </>
  );
}

export function SchoolsTab({
  cards,
  schools,
  total,
  scopeTotal,
  filters,
  ctx,
}: {
  cards: GubunCard[];
  /** 지금 쪽에 보일 행 */
  schools: School[];
  total: number;
  scopeTotal: number;
  filters: SchoolFilters;
  ctx: ListContext;
}) {
  return (
    <SmsListShell
      ctx={ctx}
      top={<GubunCards cards={cards} selected={filters.gubun} />}
      controls={<SchoolControls filters={filters} />}
      title="학교"
      count={total}
      unit="곳"
      scopeTotal={scopeTotal}
      emptyText="조건에 맞는 학교가 없습니다"
    >
      {({ selectedNo, select }) => (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              {HEADS.map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <SchoolRow
                key={s.no}
                school={s}
                selected={selectedNo === s.no}
                onSelect={() => select(s.no)}
              />
            ))}
          </tbody>
        </table>
      )}
    </SmsListShell>
  );
}
