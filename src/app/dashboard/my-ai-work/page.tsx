import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listAiWorks } from "@/features/ai-work/queries";
import { listOperators } from "@/features/operators/queries";
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
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

export default async function MyAiWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; page?: string }>;
}) {
  const slug = "my-ai-work";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();
  const allWorks = await listAiWorks();
  const allOperators = await listOperators();
  // 후보는 재직 중 + 본인 제외 (backup 도메인과 동일 규칙).
  const aiWorkOperators = allOperators
    .filter((op) => op.status === "active" && op.email !== me?.email)
    .map((op) => ({ email: op.email, name: op.name }));
  // 표시 이름은 퇴사자도 풀어야 하므로 필터 전 전체 목록으로 만든다.
  const operatorNameByEmail = new Map(
    allOperators.map((op) => [op.email, op.name] as const),
  );
  const mine = sp.mine !== "false";
  const works =
    mine && me?.email
      ? allWorks.filter((w) => w.author_email === me.email)
      : allWorks;
  const ownerByEmail = await buildOwnerMap(works);
  const { rows, total } = paginateRows(
    works.map((w) => aiWorkToListRow(w, ownerByEmail, operatorNameByEmail)),
    sp.page,
  );
  const config = resolvePageMeta(slug, meta, total);

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
        work_start_date: row.workStartDate ?? "",
        work_end_date: row.workEndDate ?? row.workStartDate ?? "",
        ai_tool: row.aiTool ?? "etc",
        category: row.category ?? "etc",
        summary_md: row.summary ?? "",
        feature_desc: row.featureDesc ?? null,
        output_url: row.outputUrl ?? null,
        reuse_prompt: row.reusePrompt ?? null,
        saved_hours: row.savedHours ?? null,
        tags: row.tags ?? [],
        collaborator_emails: row.collaboratorEmails ?? [],
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteAiWork(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateAiWork(row.id, {
      title: row.name,
      work_start_date: row.workStartDate,
      work_end_date: row.workEndDate,
      ai_tool: row.aiTool as AiTool | undefined,
      category: row.category as AiWorkCategory | undefined,
      summary_md: row.summary,
      feature_desc: row.featureDesc ?? null,
      output_url: row.outputUrl ?? null,
      reuse_prompt: row.reusePrompt ?? null,
      saved_hours: row.savedHours ?? null,
      tags: row.tags,
      collaborator_emails: row.collaboratorEmails ?? [],
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
      currentUserEmail={me?.email ?? null}
      currentUserPermission={me?.permission ?? null}
      aiWorkOperators={aiWorkOperators}
      inlineFilters={
        <ScopeChips key="ai-work-scope" total={total} mineLabel="내 작업" />
      }
      onPersist={onPersist}
      footer={
        <ListPagination key="ai-work-pagination" total={total} pageSize={30} />
      }
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
  nameByEmail: Map<string, string>,
): ListRow {
  return {
    id: w.id,
    name: w.title,
    status: "active",
    owner: ownerByEmail.get(w.author_email) ?? w.author_email,
    authorEmail: w.author_email,
    collaboratorEmails: w.collaborator_emails,
    collaboratorNames: w.collaborator_emails.map(
      (email) => nameByEmail.get(email) ?? email.split("@")[0] ?? email,
    ),
    workStartDate: w.work_start_date,
    workEndDate: w.work_end_date,
    aiTool: w.ai_tool,
    category: w.category,
    summary: w.summary_md,
    featureDesc: w.feature_desc ?? null,
    outputUrl: w.output_url ?? null,
    reusePrompt: w.reuse_prompt ?? null,
    savedHours: w.saved_hours ?? null,
    tags: w.tags,
  };
}
