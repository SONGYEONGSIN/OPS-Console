"use client";

import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import type { NumberFilters } from "@/features/sms-sender/filters";
import type { SenderNumber } from "@/features/sms-sender/types";
import { useDebouncedSearch, useSetParams } from "./use-set-params";
import { SmsListShell, rowProps, type ListContext } from "./SmsListShell";

const DEFICIENT = "서류 미비";
const HEADS = ["발신번호", "학교", "상태", "등록일", "제출 서류", "비고"];

function NumberControls({
  filters,
  statusOptions,
  gubunOptions,
}: {
  filters: NumberFilters;
  statusOptions: string[];
  gubunOptions: string[];
}) {
  const setParams = useSetParams();
  const [q, setQ] = useDebouncedSearch("q");
  return (
    <>
      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="발신번호 또는 학교명 — 하이픈 없이도"
      />
      <ListSelect
        value={filters.status}
        onChange={(v) => setParams({ status: v || null })}
        options={statusOptions}
        placeholder="상태 전체"
        ariaLabel="상태 필터"
      />
      <ListSelect
        value={filters.gubun}
        onChange={(v) => setParams({ gubun: v || null })}
        options={gubunOptions}
        placeholder="구분 전체"
        ariaLabel="구분 필터"
      />
    </>
  );
}

export function NumbersTab({
  rows,
  total,
  scopeTotal,
  filters,
  statusOptions,
  gubunOptions,
  ctx,
}: {
  /** 지금 쪽에 보일 행 */
  rows: SenderNumber[];
  total: number;
  scopeTotal: number;
  filters: NumberFilters;
  statusOptions: string[];
  gubunOptions: string[];
  ctx: ListContext;
}) {
  return (
    <SmsListShell
      ctx={ctx}
      controls={
        <NumberControls
          filters={filters}
          statusOptions={statusOptions}
          gubunOptions={gubunOptions}
        />
      }
      title="발신번호"
      count={total}
      unit="건"
      scopeTotal={scopeTotal}
      emptyText="조건에 맞는 발신번호가 없습니다"
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
            {rows.map((n) => {
              const no = n.schoolNo;
              return (
                <tr
                  key={n.no}
                  {...rowProps({
                    selected: no !== null && selectedNo === no,
                    onSelect: no === null ? null : () => select(no),
                  })}
                >
                  <td className="px-3 py-2 tabular-nums">{n.number}</td>
                  <td className="px-3 py-2">{n.school}</td>
                  <td
                    className={`px-3 py-2 ${
                      n.status === DEFICIENT ? "text-vermilion" : ""
                    }`}
                  >
                    {n.status}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {n.registeredAt ?? "–"}
                  </td>
                  <td className="px-3 py-2">{n.docs}</td>
                  <td className="px-3 py-2">{n.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SmsListShell>
  );
}
