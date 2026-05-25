import Link from "next/link";
import { findSidebarMeta } from "../_data";
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
  J: "고객지원팀",
  K: "아르바이트 채용 · 관리",
  Y: "패키지 · 관리자 운영",
  Z: "출력 · 정산 · 인증 관리",
};

/** 폴더는 명시한 화이트리스트만 노출 (나머지 정렬 보조용 폴더 제외) */
const FOLDER_WHITELIST = new Set(["내부회계관리제도"]);

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

function hintFor(category: string, items: CategoryItem[], total: number): string {
  if (category === "all") return `총 ${total}개 항목`;
  const item = items.find((c) => c.value === category);
  if (!item) return "";
  const isFolder = category === "_folder";
  return isFolder ? `${item.count}개 폴더` : `${item.count}개 매뉴얼`;
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

  const rawRows = await listManualChildren({ parentItemId: itemId ?? null });
  // 폴더는 화이트리스트만 통과 (현재 '내부회계관리제도'만). 파일은 모두 통과.
  const allRows = rawRows.filter(
    (r) => r.kind === "file" || FOLDER_WHITELIST.has(r.name),
  );
  const categories = categoryItemsFrom(allRows);
  const inSubfolder = Boolean(itemId);

  const afterCategory = inSubfolder
    ? allRows
    : filterByCategory(allRows, category);
  const filtered = qRaw
    ? afterCategory.filter((r) => r.name.toLowerCase().includes(qLower))
    : afterCategory;

  const heading = inSubfolder
    ? "하위 폴더 내용"
    : headingFor(category, categories);
  const hint = inSubfolder
    ? `${allRows.length}개 항목`
    : hintFor(category, categories, allRows.length);

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">{meta.label}</h2>
        <p className="mt-1 text-xs text-muted">
          SharePoint 운영부/05. 매뉴얼 폴더 — 행 클릭 시 SharePoint 웹으로 이동
        </p>
      </header>

      {inSubfolder ? (
        <div className="mb-4 flex items-center gap-3 border-b border-line-soft pb-2 text-sm">
          <Link href={pathname} className="text-vermilion hover:underline">
            ← 매뉴얼 루트로
          </Link>
          <span className="text-muted">하위 폴더 보기 중</span>
        </div>
      ) : null}

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        {inSubfolder ? (
          <div />
        ) : (
          <ManualSidebar totalCount={allRows.length} categories={categories} />
        )}
        <ManualList heading={heading} hint={hint} rows={filtered} />
      </div>
    </section>
  );
}
