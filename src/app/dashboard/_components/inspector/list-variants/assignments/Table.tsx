"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";
import type { AssignmentBadge } from "@/features/assignments/badges";
import { ASSIGNMENT_BADGE_TONE } from "./status";

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
  if (
    !rec ||
    (!rec.operator &&
      !rec.developer &&
      !(rec.subtypes && rec.subtypes.length > 0))
  ) {
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

/**
 * 대학 단위 배지. 판정은 `features/assignments/badges.ts`, 색은 `./status.ts`.
 * 모르는 배지 문자열은 그리지 않는다 — 색 없는 배지가 뜨느니 안 뜨는 편이 낫다.
 */
function Badges({ badges }: { badges?: string[] }) {
  if (!badges?.length) return null;
  return (
    <span className="ml-2 inline-flex gap-1">
      {badges.map((b) => {
        const tone = ASSIGNMENT_BADGE_TONE[b as AssignmentBadge];
        if (!tone) return null;
        return (
          <span key={b} className={`px-1.5 py-0.5 text-2xs ${tone}`}>
            {b}
          </span>
        );
      })}
    </span>
  );
}

/**
 * **행 클릭이 인스펙터를 연다**(PR4a에서 되살림).
 *
 * `26e16a42`(2026-05-22)가 "읽기 전용 그리드"라며 껐다. 그때는 화면이 시트를
 * 보여주기만 했으니 맞았다. 지금은 원장이 원천이고 **편집·변경 이력·되돌리기가
 * 인스펙터 안에 있어서**, 안 열리면 거기 닿을 길이 없다.
 */
export function AssignmentsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학</th>
          {SERVICE_KINDS.map((s) => (
            <th key={s} className="px-3 py-2">
              {SERVICE_LABEL[s] ?? s}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            className={`cursor-pointer border-b transition-colors ${
              selectedId === row.id
                ? "border-vermilion bg-vermilion/10 text-vermilion"
                : "border-line-soft hover:bg-line-soft"
            }`}
          >
            <td className="px-3 py-2 font-medium text-ink">
              {row.name}
              <Badges badges={row.assignment?.badges} />
            </td>
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
