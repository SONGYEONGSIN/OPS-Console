"use client";

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
 * 구분 카드 — 운영리포트 '서비스' 카드(`ServiceFlowCard`) 모양 한 장에 구분마다 칸 하나
 * (사용자 지시 2026-11-05). 구분별로 카드를 따로 세웠더니 견줄 이전 기간이 없어
 * 늘 '비교 불가' 가 떠 있었고, 회선·서류 미비·확인 줄은 카드 테두리 밖에 떠 있었다.
 * 그 줄은 이제 증감 줄 자리, 칸 안에 든다.
 *
 * 칸 전체가 구분 필터 버튼이다. 버튼 컨트롤이 아니라 면(面)이라 검정 호버 대신
 * 목록 항목 표준(`hover:bg-line-soft`, 선택 `bg-vermilion/10` + 라벨 vermilion)을 쓴다.
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
    <div className="px-7 pt-3">
      <div
        role="group"
        aria-label="구분"
        className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
      >
        <div className="text-xs font-medium text-muted">구분</div>
        <div className="flex flex-wrap gap-3">
          {cards.map((c, i) => {
            const on = c.gubun === selected;
            return (
              /*
               * `flex-1`(basis 0)만 두면 폰에서 줄바꿈 대신 다섯 칸이 짓눌린다 —
               * basis 를 줘서 좁으면 다음 줄로 넘어가게 한다. 구분선은 그때 줄 맨 앞에
               * 홀로 남으므로 그 폭에서는 숨긴다(`SheetBreakdownCard` 와 같은 규칙).
               */
              <div key={c.gubun} className="flex grow basis-32 gap-3">
                {i > 0 ? (
                  <div className="hidden w-px shrink-0 self-stretch bg-line-soft sm:block" />
                ) : null}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setParams({ gubun: on ? null : c.gubun })}
                  className={`flex flex-1 cursor-pointer flex-col gap-0.5 px-2 py-1 text-left transition-colors ${
                    on ? "bg-vermilion/10" : "hover:bg-line-soft"
                  }`}
                >
                  <div
                    className={`whitespace-nowrap text-2xs ${
                      on ? "text-vermilion" : "text-muted"
                    }`}
                  >
                    {c.gubun}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-ink">
                      {c.schools.toLocaleString("ko-KR")}
                    </span>
                    <span className="text-2xs text-muted">곳</span>
                  </div>
                  <div className="text-xs tabular-nums text-muted">
                    {`회선 ${c.lines} · 서류 미비 ${c.deficient} · 확인 ${c.checks}`}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
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
