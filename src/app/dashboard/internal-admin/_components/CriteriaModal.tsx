"use client";

import { ModalShell } from "@/components/common/ModalShell";

type Props = { rows: string[][]; onClose: () => void };

/** `05. 제출 서류 기준` 시트를 가공 없이 그대로 보여 준다. */
export function CriteriaModal({ rows, onClose }: Props) {
  return (
    <ModalShell title="제출 서류 기준" size="xl" onClose={onClose}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line-soft">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
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
