import Link from "next/link";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listManualChildren } from "@/features/manuals/queries";
import type { ManualRow } from "@/features/manuals/schemas";
import { ManualSidebar, type CategoryItem } from "./_components/ManualSidebar";
import { ManualList } from "./_components/ManualList";

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

type GroupKey = string;

function groupKeyFor(row: ManualRow): GroupKey {
  if (row.kind === "folder") return "_folder";
  return row.category ?? "_etc";
}

function categoryItemsFrom(rows: ManualRow[]): CategoryItem[] {
  const map = new Map<GroupKey, CategoryItem>();
  for (const row of rows) {
    const key = groupKeyFor(row);
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    if (key === "_folder") {
      map.set(key, { value: "_folder", label: "폴더", desc: null, sortOrder: 0, count: 1 });
    } else if (key === "_etc") {
      map.set(key, { value: "_etc", label: "기타", desc: null, sortOrder: 99, count: 1 });
    } else {
      map.set(key, {
        value: key,
        label: key,
        desc: CATEGORY_DESCRIPTIONS[key] ?? null,
        sortOrder: key.charCodeAt(0) - "A".charCodeAt(0) + 1,
        count: 1,
      });
    }
  }
  return Array.from(map.values());
}

function headingFor(category: string, items: CategoryItem[]): string {
  if (category === "all") return "전체";
  const item = items.find((c) => c.value === category);
  if (!item) return category;
  return item.desc ? `${item.label} — ${item.desc}` : item.label;
}

function filterByCategory(rows: ManualRow[], category: string): ManualRow[] {
  if (category === "all") return rows;
  return rows.filter((r) => groupKeyFor(r) === category);
}

export default async function ManualsPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; q?: string; category?: string }>;
}) {
  const slug = "manuals";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const itemId = sp.itemId?.trim() || undefined;
  const category = (sp.category?.trim() || "all") as string;
  const qRaw = (sp.q ?? "").trim();
  const qLower = qRaw.toLowerCase();

  const allRows = await listManualChildren({ parentItemId: itemId ?? null });
  const categories = categoryItemsFrom(allRows);
  const inSubfolder = Boolean(itemId);

  // 카테고리 필터링 (루트일 때만) + 검색
  const afterCategory = inSubfolder
    ? allRows
    : filterByCategory(allRows, category);
  const filtered = qRaw
    ? afterCategory.filter((r) => r.name.toLowerCase().includes(qLower))
    : afterCategory;

  const heading = inSubfolder
    ? "하위 폴더 내용"
    : headingFor(category, categories);
  const config = resolvePageMeta(slug, meta, allRows.length);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      {inSubfolder ? (
        <div className="flex items-center gap-3 border-b border-line-soft bg-washi px-7 py-2 text-sm">
          <Link href={pathname} className="text-vermilion hover:underline">
            ← 매뉴얼 루트로
          </Link>
          <span className="text-muted">하위 폴더 보기 중</span>
        </div>
      ) : null}
      <div className="flex flex-1">
        {inSubfolder ? null : (
          <ManualSidebar totalCount={allRows.length} categories={categories} />
        )}
        <ManualList heading={heading} rows={filtered} />
      </div>
    </div>
  );
}
