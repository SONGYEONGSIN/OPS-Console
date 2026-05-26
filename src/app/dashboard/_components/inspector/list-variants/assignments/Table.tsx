"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/** 원서접수 컬럼 헤더 레이블 오버라이드 */
const SERVICE_LABEL: Record<string, string> = { 원서접수: "학부" };

type Rec = {
  operator: string;
  developer: string;
  detail: { label: string; value: string }[];
  subtypes?: { label: string; operator: string; developer: string }[];
};

function pairText(op: string, dev: string): string {
  if (!op && !dev) return "—";
  if (!dev) return op || "—";
  return `${op || "—"} / ${dev}`;
}

function AssignmentCell({ rec }: { rec?: Rec }) {
  if (!rec || (!rec.operator && !rec.developer && !(rec.subtypes && rec.subtypes.length > 0))) {
    return <>—</>;
  }
  if (rec.subtypes && rec.subtypes.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {rec.subtypes.map((s, i) => (
          <div key={i}>
            <span className="text-muted">{s.label} </span>
            {pairText(s.operator, s.developer)}
          </div>
        ))}
      </div>
    );
  }
  return <>{pairText(rec.operator, rec.developer)}</>;
}

// 대학배정 그리드는 읽기 전용 — 행 클릭(인스펙터) 비활성. selectedId/onSelect 미사용.
export function AssignmentsTable({ rows }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학</th>
          {SERVICE_KINDS.map((s) => (
            <th key={s} className="px-3 py-2">{SERVICE_LABEL[s] ?? s}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-line-soft">
            <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
            {SERVICE_KINDS.map((s) => (
              <td key={s} className="px-3 py-2 text-ink">
                <AssignmentCell rec={row.assignment?.byService[s]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
