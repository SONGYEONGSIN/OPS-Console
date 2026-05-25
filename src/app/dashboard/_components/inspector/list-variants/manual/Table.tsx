"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatShortDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function formatSize(bytes?: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function categoryLabel(category: string | null | undefined): string {
  return category ?? "기타";
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  A: "원서접수",
  B: "보증보험",
  C: "결제사",
  D: "정산 · 세금",
  E: "사이트 운영",
  F: "합격자관리",
  G: "모의논술",
  H: "외부 사업",
  I: "영국문화원 · 홍대미활",
};

type Group = {
  /** 정렬용 key — 폴더(0) → A~I(1~9) → 기타(99) */
  sortOrder: number;
  /** 그룹 라벨 (UI 표시) */
  label: string;
  /** 그룹 설명 (A→원서접수 등) */
  desc: string | null;
  rows: ListRow[];
};

function groupRows(rows: ListRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const row of rows) {
    let key: string;
    let sortOrder: number;
    let label: string;
    let desc: string | null;

    if (row.manualKind === "folder") {
      key = "_folder";
      sortOrder = 0;
      label = "폴더";
      desc = null;
    } else if (row.manualCategory) {
      key = row.manualCategory;
      sortOrder = row.manualCategory.charCodeAt(0) - "A".charCodeAt(0) + 1;
      label = row.manualCategory;
      desc = CATEGORY_DESCRIPTIONS[row.manualCategory] ?? null;
    } else {
      key = "_etc";
      sortOrder = 99;
      label = "기타";
      desc = null;
    }

    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      map.set(key, { sortOrder, label, desc, rows: [row] });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function ManualTable({ rows, selectedId, onSelect }: Props) {
  const groups = groupRows(rows);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">종류</th>
          <th className="px-3 py-2">수정일</th>
          <th className="px-3 py-2">크기</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          groups.map((g) => (
            <GroupBlock
              key={g.label}
              group={g}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

function GroupBlock({
  group,
  selectedId,
  onSelect,
}: {
  group: Group;
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
}) {
  return (
    <>
      <tr className="border-b border-line bg-washi-raised/60">
        <td
          colSpan={5}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft"
        >
          <span className="mr-2 text-vermilion">▼</span>
          {group.label}
          {group.desc ? <span className="mx-1 text-muted">— {group.desc}</span> : null}
          <span className="ml-1 text-muted">({group.rows.length})</span>
        </td>
      </tr>
      {group.rows.map((row) => {
        const isFolder = row.manualKind === "folder";
        return (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
              selectedId === row.id ? "bg-washi-raised" : ""
            }`}
          >
            <td className="px-3 py-2 font-medium text-ink">
              <span className="mr-2 text-muted">{isFolder ? "▦" : "§"}</span>
              {row.name}
            </td>
            <td className="px-3 py-2">
              <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                {categoryLabel(row.manualCategory)}
              </span>
            </td>
            <td className="px-3 py-2 text-sm text-ink-soft">
              {isFolder ? "폴더" : "파일"}
            </td>
            <td className="px-3 py-2 text-sm text-ink-soft">
              {formatShortDate(row.manualModified)}
            </td>
            <td className="px-3 py-2 text-sm text-ink-soft">
              {formatSize(row.manualSize)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
