import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listAiTips } from "@/features/ai-tips/queries";
import {
  createAiTip,
  updateAiTip,
  deleteAiTip,
} from "@/features/ai-tips/actions";
import { listCandidates } from "@/features/ai-tip-candidates/queries";
import {
  TipCandidateSection,
  filterByScope,
} from "./_components/TipCandidateSection";
import { PageTabs } from "@/components/common/PageTabs";
import type { AiTipRow } from "@/features/ai-tips/schemas";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

/**
 * 탭 둘. 기본 탭은 **파라미터 없는 기존 주소**를 그대로 쓴다 — 주소에 기본값을
 * 적어두면 나중에 기본이 바뀌어도 예전 주소가 옛 화면에 갇힌다.
 */
const TABS = [
  { key: "tips", label: "등록된 TIP", href: "/dashboard/ai-tips" },
  {
    key: "candidates",
    label: "TIP 후보",
    href: "/dashboard/ai-tips?tab=candidates",
  },
] as const;

export default async function AiTipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mine?: string;
    page?: string;
    tab?: string;
    scope?: string;
  }>;
}) {
  const slug = "ai-tips";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();
  const allTips = await listAiTips();
  // 전건을 그대로 넘긴다 — 숨김·등록됨도 화면에서 되짚어야 한다.
  // 후보를 **여기서 한 번만** 읽는 이유: 섹션이 따로 읽으면 헤더 건수와 목록이
  // 서로 다른 시점을 보게 된다(수집 잡이 도는 중이면 실제로 갈린다).
  const candidates = await listCandidates();
  // 모르는 탭 값은 기본으로 떨어진다 — 주소를 잘못 고쳐도 빈 화면이 안 된다.
  const requested = sp.tab ?? "tips";
  const tab = TABS.some((t) => t.key === requested) ? requested : "tips";
  const mine = sp.mine !== "false";
  const tips =
    mine && me?.email
      ? allTips.filter((t) => t.author_email === me.email)
      : allTips;
  const ownerByEmail = await buildOwnerMap(tips);
  const { rows, total } = paginateRows(
    tips.map((t) => aiTipToListRow(t, ownerByEmail)),
    sp.page,
  );
  // 헤더 건수는 **보고 있는 탭**의 건수다. 등록된 TIP 수를 후보 탭에 띄우면
  // 화면에 보이는 목록과 머리말이 어긋난다.
  const activeCount =
    tab === "candidates" ? filterByScope(candidates, sp.scope).length : total;
  const config = resolvePageMeta(slug, meta, activeCount);

  const canWrite = me?.permission !== "viewer" && me?.permission !== null;

  const header = (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      {/*
        후보가 0건이어도 탭은 그린다. 전에는 '없으면 안 그린다'였는데, 그러면
        숨긴 후보를 되돌리러 들어갈 입구 자체가 사라진다 — 검토 대기가 0건인
        평상시가 바로 그 상태다.
      */}
      <PageTabs tabs={TABS} active={tab} />
    </>
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      const result = await createAiTip({
        title: row.name,
        ai_tool: row.aiTool ?? "etc",
        category: row.category ?? "etc",
        summary_md: row.summary ?? "",
        reuse_prompt: row.reusePrompt ?? "",
        tags: row.tags ?? [],
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteAiTip(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateAiTip(row.id, {
      title: row.name,
      ai_tool: row.aiTool as AiTool | undefined,
      category: row.category as AiWorkCategory | undefined,
      summary_md: row.summary,
      reuse_prompt: row.reusePrompt ?? undefined,
      tags: row.tags,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (tab === "candidates")
    return (
      <>
        {header}
        <TipCandidateSection
          candidates={candidates}
          scope={sp.scope}
          page={sp.page}
          canDecide={canWrite}
        />
      </>
    );

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="ai-tips"
      canCreate={canWrite}
      createLabel="+ TIP 등록"
      readOnly={!canWrite}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      currentUserEmail={me?.email ?? null}
      currentUserPermission={me?.permission ?? null}
      inlineFilters={
        <ScopeChips key="ai-tips-scope" total={total} mineLabel="내 TIP" />
      }
      onPersist={onPersist}
      footer={
        <ListPagination key="ai-tips-pagination" total={total} pageSize={30} />
      }
    />
  );
}

async function buildOwnerMap(tips: AiTipRow[]): Promise<Map<string, string>> {
  const emails = Array.from(new Set(tips.map((t) => t.author_email)));
  if (emails.length === 0) return new Map();
  const { OPERATORS } = await import("@/features/auth/operators");
  const map = new Map<string, string>();
  for (const email of emails) {
    const op = OPERATORS.find((o) => o.email === email);
    map.set(email, op?.name ?? email.split("@")[0] ?? email);
  }
  return map;
}

function aiTipToListRow(
  t: AiTipRow,
  ownerByEmail: Map<string, string>,
): ListRow {
  return {
    id: t.id,
    name: t.title,
    status: "active",
    owner: ownerByEmail.get(t.author_email) ?? t.author_email,
    authorEmail: t.author_email,
    aiTool: t.ai_tool,
    category: t.category,
    summary: t.summary_md,
    reusePrompt: t.reuse_prompt,
    tags: t.tags,
  };
}
