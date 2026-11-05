"use client";

import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import type { School } from "@/features/sms-sender/types";
import {
  STAGE_OPTIONS,
  stageLabel,
  type GubunCard,
  type SchoolFilters,
} from "@/features/sms-sender/filters";
import { useDebouncedSearch, useSetParams } from "./use-set-params";
import { SmsListShell, rowProps, type ListContext } from "./SmsListShell";
import { docTally } from "./doc-mark";

const DOCS_OPTIONS = ["완비", "미비", "확인 안 됨"] as const;
const HEADS = ["학교명", "구분", "단계", "회선", "서류", "확인", "PDF"];

/** 한 줄 칸 수 — Tailwind 가 읽도록 통째 문자열로 둔다(카드는 4장, 기타가 있으면 5장). */
const WIDE_COLS: Record<number, string> = {
  4: "@3xl:grid-cols-4",
  5: "@3xl:grid-cols-5",
};
/** 두 칸일 때 홀로 남는 마지막 카드(기타)는 두 칸을 다 쓴다 — 옆이 빈 채로 줄이 바뀌지 않게. */
const ODD_LAST_SPAN =
  "[&>*:last-child:nth-child(odd)]:col-span-2 @3xl:[&>*:last-child:nth-child(odd)]:col-span-1";

/**
 * 구분 카드 — 구분마다 따로 선 카드(사용자 지시 2026-11-05). 한 장에 칸을 세로선으로
 * 나눴더니 어느 칸이 눌렸는지 흐려졌다. 카드마다 테두리가 있어 선택이 테두리째 드러난다.
 *
 * 카드 전체가 구분 필터 버튼이다. 버튼 컨트롤이 아니라 면(面)이라 검정 호버 대신
 * 목록 항목 표준(`hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10` + 라벨
 * vermilion)을 쓴다. 좁으면 두 칸, 넓으면 한 줄 — 폭은 뷰포트가 아니라 컨테이너가
 * 정한다(사이드바·인스펙터가 줄인다). 그래서 `sm:` 이 아니라 컨테이너 쿼리다.
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
    <div className="@container px-7 pt-3">
      <div
        role="group"
        aria-label="구분"
        className={`grid grid-cols-2 gap-3 ${ODD_LAST_SPAN} ${WIDE_COLS[cards.length] ?? WIDE_COLS[4]}`}
      >
        {cards.map((c) => {
          const on = c.gubun === selected;
          return (
            <button
              key={c.gubun}
              type="button"
              aria-pressed={on}
              onClick={() => setParams({ gubun: on ? null : c.gubun })}
              className={`flex cursor-pointer flex-col gap-0.5 border p-4 text-left transition-colors ${
                on
                  ? "border-vermilion bg-vermilion/10"
                  : "border-line-soft bg-situation-bg hover:bg-line-soft"
              }`}
            >
              <div
                className={`whitespace-nowrap text-xs font-medium ${
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
                {`회선 ${c.lines.toLocaleString("ko-KR")} · 서류 미비 ${c.deficient.toLocaleString("ko-KR")} · 확인 ${c.checks.toLocaleString("ko-KR")}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 미제출 이름은 둘까지 적고 나머지는 '외 N' — 전체는 title 에. */
const MISSING_SHOWN = 2;

/**
 * 서류 칸 — 여덟 개 점(O·✕)은 무엇이 빠졌는지 세어 봐야 알았다. 몇 종을 냈는지와
 * 빠진 서류 이름을 바로 적는다. 숫자는 한 텍스트 노드에 둔다.
 *
 * 앞말(완비·미비·확인 안 됨)은 서류 필터와 같은 원천인 제출 상태(`completeness`)를
 * 따르고, 표시 집계는 그 뒤의 세부다. 집계로 앞말을 정하면 '미비' 로 거른 줄이
 * '완비 8/8' 로 읽힌다.
 */
function DocSummary({ docs }: { docs: School["docs"] }) {
  if (!docs || docs.completeness === "확인 안 됨") {
    return <span className="text-muted">확인 안 됨</span>;
  }
  const { submitted, total, missing } = docTally(docs);
  if (docs.completeness === "완비") {
    return (
      <span className="tabular-nums text-ink">{`완비 ${submitted}/${total}`}</span>
    );
  }
  const rest = missing.length - MISSING_SHOWN;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums text-ink">{`${submitted}/${total}`}</span>
      <span className="text-muted"> · </span>
      {missing.length > 0 ? (
        <span title={`${missing.join("·")} 미제출`} className="text-vermilion">
          {`${missing.slice(0, MISSING_SHOWN).join("·")}${rest > 0 ? ` 외 ${rest}` : ""} 미제출`}
        </span>
      ) : (
        <span className="text-vermilion">미비</span>
      )}
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
        <DocSummary docs={school.docs} />
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
