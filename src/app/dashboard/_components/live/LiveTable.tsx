"use client";

import { DomainBadge } from "./DomainBadge";
import type { LiveTableItem } from "./live-table-builder";

type Props = {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
};

/** 정식 운영 테이블 — 구분 / 상태 / 타이틀 / 발생 시점. 행 클릭 → onSelect. */
export function LiveTable({ items, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-20 border-b border-ink px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              구분
            </th>
            <th className="w-24 border-b border-ink px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              상태
            </th>
            <th className="border-b border-ink px-3 py-2.5 text-left text-xs font-bold text-ink-soft">
              내용
            </th>
            <th className="w-28 border-b border-ink px-3 py-2.5 text-right text-xs font-bold text-ink-soft">
              발생 시점
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-12 text-center text-sm text-ink-muted">
                표시할 항목이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr
                key={it.id}
                onClick={() => onSelect(it)}
                className="cursor-pointer border-b border-line-soft bg-transparent transition-colors last:border-b-0 hover:bg-washi-raised"
              >
                <td className="px-3 py-3 align-middle">
                  <DomainBadge domain={it.badgeDomain} />
                </td>
                <td className="px-3 py-3 align-middle text-sm font-semibold text-ink-soft">
                  {it.statusText}
                </td>
                <td className="px-3 py-3 align-middle text-sm font-medium text-ink">
                  {it.title}
                </td>
                <td className="px-3 py-3 text-right align-middle text-xs text-ink-muted tabular-nums">
                  {it.timeText}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
