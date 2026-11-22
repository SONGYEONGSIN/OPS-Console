"use client";

import type { ReactNode } from "react";

export type RosterRow = {
  email: string;
  name: string | null;
  team: string | null;
};

type Props<R extends RosterRow> = {
  rows: readonly R[];
  /** 표의 접근성 이름 — 관리 칸마다 표가 하나씩이라 이름으로 가른다 */
  label: string;
  /** 맨 앞 칸(순번 등). 없으면 이름부터 */
  lead?: { header: string; cell: (row: R) => ReactNode };
  /** 행 끝 상태·버튼 칸 */
  action: { header: string; cell: (row: R) => ReactNode };
  emptyText?: string;
};

const CELL = "px-3 py-2";

/**
 * 관리 탭의 사람 목록 — 팀·이름·이메일 순(팀이 맨 앞, 순번 칸이 있으면 그 뒤) + 행 끝 버튼 칸.
 * 당번 지정·받는 사람·당번 순번·작성 제외가 같이 쓴다.
 */
export function RosterTable<R extends RosterRow>(props: Props<R>) {
  const { rows, label, lead, action } = props;
  return (
    // 일회성: 열이 좁은 화면에서 찌그러지지 않는 최소 폭
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            {lead ? <th className={`${CELL} w-14`}>{lead.header}</th> : null}
            <th className={CELL}>팀</th>
            <th className={CELL}>이름</th>
            <th className={CELL}>이메일</th>
            <th className={`${CELL} text-right`}>{action.header}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={lead ? 5 : 4}
                className="px-3 py-6 text-center text-muted"
              >
                {props.emptyText ?? "데이터 없음"}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.email}
                className="border-b border-line-soft hover:bg-line-soft"
              >
                {lead ? (
                  <td className={`${CELL} tabular-nums text-ink-soft`}>
                    {lead.cell(row)}
                  </td>
                ) : null}
                <td className={`${CELL} text-ink-soft`}>{row.team ?? "—"}</td>
                <td className={`${CELL} font-medium text-ink`}>
                  {row.name ?? row.email}
                </td>
                <td className={`${CELL} font-mono text-xs text-muted`}>
                  {row.name === null ? "" : row.email}
                </td>
                <td className={`${CELL} text-right`}>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {action.cell(row)}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
