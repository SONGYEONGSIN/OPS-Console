"use client";

import { ListPagination } from "@/components/common/ListPagination";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import {
  NUMBERS_PAGE_SIZE,
  type NumberFilters,
} from "@/features/sms-sender/filters";
import type { SenderNumber } from "@/features/sms-sender/types";
import { useDebouncedSearch, useSetParams } from "./use-set-params";

const TH = "px-3 py-2 font-normal";
const DEFICIENT = "서류 미비";

export function NumbersTab({
  rows,
  total,
  filters,
  statusOptions,
  gubunOptions,
}: {
  rows: SenderNumber[];
  total: number;
  filters: NumberFilters;
  statusOptions: string[];
  gubunOptions: string[];
}) {
  const setParams = useSetParams();
  const [q, setQ] = useDebouncedSearch("q");
  return (
    <div>
      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="발신번호 또는 학교명 — 하이픈 없이도"
        className="mb-3 max-w-xl"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        <span className="text-sm tabular-nums text-muted">{`${total}건`}</span>
      </div>
      {rows.length === 0 ? (
        <p className="bg-situation-bg px-3 py-8 text-center text-sm text-muted">
          조건에 맞는 발신번호가 없습니다
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              {["발신번호", "학교", "상태", "등록일", "제출 서류", "비고"].map(
                (h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr
                key={n.no}
                className="border-b border-line-soft hover:bg-line-soft"
              >
                <td className="px-3 py-2 font-mono tabular-nums">{n.number}</td>
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
            ))}
          </tbody>
        </table>
      )}
      <ListPagination total={total} pageSize={NUMBERS_PAGE_SIZE} />
    </div>
  );
}
