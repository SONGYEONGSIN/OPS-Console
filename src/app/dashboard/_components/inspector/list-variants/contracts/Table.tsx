"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/**
 * 계약 종료월의 무게를 색으로 가른다.
 *
 * 대장에 실제로 적힌 값과 우리가 학년도로 채운 값이 같은 색이면 화면만 보고는
 * 구분할 수 없다. 특히 `check` — 다년계약인데 대장에 종료일이 없는 9곳은
 * 채운 값이 확실히 틀리므로 눈에 걸리게 둔다.
 */
function endTone(kind?: string): string {
  if (kind === "check") return "text-vermilion";
  if (kind === "assumed") return "text-muted";
  return "text-ink-soft";
}

/** 계약진행현황 text → tone. 빈 값(미완료)는 vermilion으로 강조 */
function statusTone(status?: string): string {
  if (!status) return "text-vermilion";
  if (status.includes("완료")) return "text-ink";
  return "text-ink-soft";
}

export function ContractsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">시트</th>
          <th className="px-3 py-2">넘버링</th>
          <th className="px-3 py-2">대학·학교명</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">계약현황</th>
          <th className="px-3 py-2">서비스</th>
          <th className="px-3 py-2">계약종료</th>
          <th className="px-3 py-2">수수료</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                selectedId === row.id ? "bg-vermilion/10" : ""
              }`}
            >
              <td className="px-3 py-2">
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.contractSheet ?? "-"}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-ink-soft">
                {row.numbering || "-"}
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.name || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.owner || "-"}
              </td>
              <td className={`px-3 py-2 text-sm ${statusTone(row.contractStatus)}`}>
                {row.contractStatus || "미완료"}
              </td>
              <td className="px-3 py-2">
                {row.serviceActive === "Y" ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    Y
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td
                className={`px-3 py-2 text-sm tabular-nums ${endTone(row.contractEndKind)}`}
                title={
                  row.contractEndKind === "check"
                    ? "다년계약인데 대장에 종료일이 없습니다 — 확인 필요"
                    : row.contractEndKind === "assumed"
                      ? "대장이 비어 있어 학년도 종료월로 표시합니다"
                      : undefined
                }
              >
                {row.contractEndMonth || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.feeAmount || "-"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
