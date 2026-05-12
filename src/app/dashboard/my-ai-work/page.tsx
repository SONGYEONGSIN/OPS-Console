import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listAiWorks } from "@/features/ai-work/queries";
import {
  createAiWork,
  updateAiWork,
  deleteAiWork,
} from "@/features/ai-work/actions";
import type {
  AiTool,
  AiWorkCategory,
  AiWorkRow,
} from "@/features/ai-work/schemas";

export default async function MyAiWorkPage() {
  const slug = "my-ai-work";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const works = await listAiWorks();
  const ownerByEmail = await buildOwnerMap(works);
  const rows: ListRow[] = works.map((w) => aiWorkToListRow(w, ownerByEmail));
  const config = resolvePageMeta(slug, meta, rows.length);

  const me = await getCurrentOperator();
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
      const result = await createAiWork({
        title: row.name,
        work_date: row.workDate ?? "",
        ai_tool: row.aiTool ?? "etc",
        category: row.category ?? "etc",
        summary_md: row.summary ?? "",
        output_url: row.outputUrl ?? null,
        reuse_prompt: row.reusePrompt ?? null,
        saved_hours: row.savedHours ?? null,
        tags: row.tags ?? [],
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteAiWork(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateAiWork(row.id, {
      title: row.name,
      work_date: row.workDate,
      ai_tool: row.aiTool as AiTool | undefined,
      category: row.category as AiWorkCategory | undefined,
      summary_md: row.summary,
      output_url: row.outputUrl ?? null,
      reuse_prompt: row.reusePrompt ?? null,
      saved_hours: row.savedHours ?? null,
      tags: row.tags,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="ai-work"
      canCreate={canWrite}
      createLabel="+ AI 활용 등록"
      readOnly={!canWrite}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      onPersist={onPersist}
    />
  );
}

async function buildOwnerMap(works: AiWorkRow[]): Promise<Map<string, string>> {
  const emails = Array.from(new Set(works.map((w) => w.author_email)));
  if (emails.length === 0) return new Map();
  const { OPERATORS } = await import("@/features/auth/operators");
  const map = new Map<string, string>();
  for (const email of emails) {
    const op = OPERATORS.find((o) => o.email === email);
    map.set(email, op?.name ?? email.split("@")[0] ?? email);
  }
  return map;
}

function aiWorkToListRow(
  w: AiWorkRow,
  ownerByEmail: Map<string, string>,
): ListRow {
  return {
    id: w.id,
    name: w.title,
    status: "active",
    owner: ownerByEmail.get(w.author_email) ?? w.author_email,
    workDate: w.work_date,
    aiTool: w.ai_tool,
    category: w.category,
    summary: w.summary_md,
    outputUrl: w.output_url ?? null,
    reusePrompt: w.reuse_prompt ?? null,
    savedHours: w.saved_hours ?? null,
    tags: w.tags,
  };
}
