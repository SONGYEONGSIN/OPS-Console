"use client";

import Link from "next/link";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";
import type { CheckFilters } from "@/features/sms-sender/filters";
import type { CheckItem } from "@/features/sms-sender/types";
import { viewHref } from "../tabs";
import { useDebouncedSearch, useSetParams } from "./use-set-params";
import { SmsListShell, rowProps, type ListContext } from "./SmsListShell";

const TEXT = "whitespace-pre-line";
const HEADS = ["유형", "대상", "내용", "근거", "할 일"];

function Target({ item }: { item: CheckItem }) {
  if (item.schoolNo == null) {
    return <span className={TEXT}>{item.target}</span>;
  }
  const [first, ...rest] = item.target.split("\n");
  return (
    <>
      <Link
        href={`${viewHref("schools")}&school=${item.schoolNo}`}
        onClick={(e) => e.stopPropagation()}
        className="underline"
      >
        {first}
      </Link>
      {rest.length > 0 && <div className={TEXT}>{rest.join("\n")}</div>}
    </>
  );
}

function CheckControls({
  filters,
  kindOptions,
}: {
  filters: CheckFilters;
  kindOptions: string[];
}) {
  const setParams = useSetParams();
  const [q, setQ] = useDebouncedSearch("q");
  return (
    <>
      <ListSearch value={q} onChange={setQ} placeholder="대상·내용 검색" />
      <ListSelect
        value={filters.kind}
        onChange={(v) => setParams({ type: v || null })}
        options={kindOptions}
        placeholder="유형 전체"
        ariaLabel="유형 필터"
      />
    </>
  );
}

/**
 * `_확인` 시트 행 + 파일 유형(이름 미대조 PDF·규칙 밖 xlsm). 파일 유형은 학교가
 * 없어서 누를 곳이 아니고 '내 대학' 에도 안 잡힌다 — 전체에서만 보인다.
 */
export function ChecksTab({
  rows,
  total,
  scopeTotal,
  filters,
  kindOptions,
  ctx,
}: {
  /** 지금 쪽에 보일 행 */
  rows: CheckItem[];
  total: number;
  scopeTotal: number;
  filters: CheckFilters;
  kindOptions: string[];
  ctx: ListContext;
}) {
  return (
    <SmsListShell
      ctx={ctx}
      controls={<CheckControls filters={filters} kindOptions={kindOptions} />}
      title="확인 필요"
      count={total}
      unit="건"
      scopeTotal={scopeTotal}
      emptyText="확인할 항목이 없습니다"
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
            {rows.map((c) => {
              const no = c.schoolNo;
              return (
                <tr
                  key={c.no}
                  {...rowProps({
                    selected: no !== null && selectedNo === no,
                    onSelect: no === null ? null : () => select(no),
                    extra: "align-top",
                  })}
                >
                  <td className="px-3 py-2">{c.kind}</td>
                  <td className="px-3 py-2">
                    <Target item={c} />
                  </td>
                  <td className={`px-3 py-2 ${TEXT}`}>{c.content}</td>
                  <td className={`px-3 py-2 ${TEXT}`}>{c.basis}</td>
                  <td className={`px-3 py-2 ${TEXT}`}>{c.todo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SmsListShell>
  );
}
