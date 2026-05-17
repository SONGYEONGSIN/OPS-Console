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
import type { AiTipRow } from "@/features/ai-tips/schemas";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";

export default async function AiTipsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const slug = "ai-tips";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();
  const allTips = await listAiTips();
  const mine = sp.mine === "true";
  const tips =
    mine && me?.email
      ? allTips.filter((t) => t.author_email === me.email)
      : allTips;
  const ownerByEmail = await buildOwnerMap(tips);
  const rows: ListRow[] = tips.map((t) => aiTipToListRow(t, ownerByEmail));
  const config = resolvePageMeta(slug, meta, rows.length);

  const canWrite = me?.permission !== "viewer" && me?.permission !== null;

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
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
      inlineFilters={
        <ScopeChips key="ai-tips-scope" total={rows.length} mineLabel="내 TIP" />
      }
      onPersist={onPersist}
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
    aiTool: t.ai_tool,
    category: t.category,
    summary: t.summary_md,
    reusePrompt: t.reuse_prompt,
    tags: t.tags,
  };
}
