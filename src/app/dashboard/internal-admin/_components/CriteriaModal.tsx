"use client";

import { ModalShell } from "@/components/common/ModalShell";

type Props = { rows: string[][]; onClose: () => void };

const LONG_TOKEN = /\S{30,}/;

function cellClass(cell: string): string {
  const base = "whitespace-pre-line break-keep px-3 py-2 align-top";
  return LONG_TOKEN.test(cell) ? `${base} [overflow-wrap:anywhere]` : base;
}

/**
 * `05. 제출 서류 기준` 시트를 가공 없이 그대로 보여 준다.
 *
 * 칸 안 줄바꿈(Alt+Enter)은 `whitespace-pre-line` 으로 살린다 — 없으면 HTML 이
 * 한 줄로 접어 글이 붙어 보인다. 한글은 낱말 중간에서 끊지 않는다(`break-keep`).
 * 아무 데서나 끊기(`overflow-wrap:anywhere`)는 공백 없는 긴 글(URL 등)이 있는
 * 칸에만 건다 — 모든 칸에 걸면 표가 열을 한 글자 폭까지 줄일 수 있어 좁은 열의
 * 한글 낱말이 끊긴다.
 * 칸이 모자란 줄(제목 줄 등)은 마지막 칸이 남은 열을 채운다 — 안 그러면 긴 제목이
 * 첫 열(No)을 넓힌다. 내용은 건드리지 않는다.
 */
export function CriteriaModal({ rows, onClose }: Props) {
  const cols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return (
    <ModalShell title="제출 서류 기준" size="xl" onClose={onClose}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line-soft">
              {row.map((cell, j) => (
                <td
                  key={j}
                  colSpan={
                    j === row.length - 1 && row.length < cols
                      ? cols - j
                      : undefined
                  }
                  className={cellClass(cell)}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}
