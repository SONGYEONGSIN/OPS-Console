"use client";

import type { LiveTableItem } from "./live-table-builder";
import { SOLID_BADGE, STATUS_DOT, TRIAGE_REF } from "./domain-tag";

type Props = {
  items: LiveTableItem[];
  onSelect: (item: LiveTableItem) => void;
};

/** OPS-6 시안 feed-table — 구분/상태/내용/담당자/발생시점/트리아지 6컬럼.
    솔리드 배지 + 상태 dot + 2줄 내용. urgent(now) 행은 vermilion 틴트 + 좌측 스트라이프.
    양쪽 외곽선 없음(좌우 패딩만). 행 클릭 → onSelect. */
export function LiveTable({ items, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {["구분", "상태", "내용", "담당자", "발생 시점", "트리아지"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`border-b border-ink bg-washi-raised py-2 text-left text-[8px] font-bold uppercase tracking-[0.2em] text-muted ${
                    i === 0 ? "pl-5 pr-3" : "px-3"
                  } ${h === "발생 시점" || h === "트리아지" ? "whitespace-nowrap" : ""} ${h === "트리아지" ? "pr-5" : ""}`}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-12 text-center text-sm text-ink-muted"
              >
                표시할 항목이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((it) => {
              const urgent = it.triage === "now";
              const ref = TRIAGE_REF[it.triage];
              return (
                <tr
                  key={it.id}
                  onClick={() => onSelect(it)}
                  className={`relative cursor-pointer border-b border-line-soft transition-colors last:border-b-0 ${
                    urgent
                      ? "bg-vermilion/[0.04] hover:bg-vermilion/[0.07]"
                      : "hover:bg-washi-raised"
                  }`}
                >
                  {/* 구분 — 솔리드 배지 (urgent 좌측 vermilion 스트라이프) */}
                  <td
                    className={`relative py-2 pl-5 pr-3 align-middle ${urgent ? "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-vermilion before:content-['']" : ""}`}
                  >
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold leading-none ${SOLID_BADGE[it.badgeDomain]}`}
                    >
                      {it.badgeDomain}
                    </span>
                  </td>
                  {/* 상태 — dot + 라벨 */}
                  <td className="whitespace-nowrap px-3 py-2 align-middle">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[it.triage]}`}
                      />
                      <span className="text-[11px] text-ink-soft">
                        {it.statusText}
                      </span>
                    </span>
                  </td>
                  {/* 내용 — 제목 + (보조) */}
                  <td className="max-w-[360px] px-3 py-2 align-middle">
                    <div className="truncate text-[13px] font-medium leading-tight text-ink">
                      {it.title}
                    </div>
                    {it.listRow.body ? (
                      <div className="truncate text-[10px] text-muted">
                        {it.listRow.body}
                      </div>
                    ) : null}
                  </td>
                  {/* 담당자 */}
                  <td className="whitespace-nowrap px-3 py-2 align-middle text-[10px] text-muted">
                    {it.listRow.owner ?? "—"}
                  </td>
                  {/* 발생 시점 */}
                  <td className="whitespace-nowrap px-3 py-2 align-middle text-[10px] text-faint tabular-nums">
                    {it.timeText}
                  </td>
                  {/* 트리아지 참조 칩 */}
                  <td className="whitespace-nowrap py-2 pl-3 pr-5 align-middle">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold tracking-[0.06em] ${ref.cls}`}
                    >
                      {ref.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
