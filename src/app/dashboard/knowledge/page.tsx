import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  listKnowledgeDocs,
  getKnowledgeDoc,
} from "@/features/knowledge/queries";
import { groupByCategory } from "@/features/knowledge/shared";
import { listOpenGaps, listPendingProposals } from "@/features/knowledge/gaps";
import { groupGaps } from "@/features/knowledge/gaps-shared";
import { KnowledgeTree } from "./_components/KnowledgeTree";
import { KnowledgeDocView } from "./_components/KnowledgeDoc";
import { KnowledgeGaps } from "./_components/KnowledgeGaps";
import { PendingProposals } from "./_components/PendingProposals";
import { FileDraftForm } from "./_components/FileDraftForm";
import { KnowledgeTabs, type KnowledgeTab } from "./_components/KnowledgeTabs";

/**
 * 업무 지식망 — 네 칸을 탭으로 나눈다(문서 / 초안 만들기 / 검토 대기 / 빈틈).
 *
 * 전에는 한 화면이었다. 문서를 안 골랐을 때 오른쪽 칸에 초안 폼과 빈틈과 검토
 * 대기가 세로로 쌓여, **문서를 보러 온 사람에게 초안 폼이 먼저 보였다.**
 *
 * 문서 칸은 좌측 트리 + 우측 문서다. 읽기 전용이고 편집은 옵시디언이 한다 —
 * 목록·인스펙터 패턴을 쓰지 않는다. 목록+상세가 아니라 문서 탐색이다.
 */
const TAB_KEYS = new Set<KnowledgeTab>(["docs", "draft", "review", "gaps"]);
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; tab?: string }>;
}) {
  const slug = "knowledge";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const rows = await listKnowledgeDocs();
  const config = resolvePageMeta(slug, meta, rows.length);
  const groups = groupByCategory(rows);

  const { doc: docParam, tab: tabParam } = await searchParams;
  const selectedPath = docParam ?? null;
  const doc = selectedPath ? await getKnowledgeDoc(selectedPath) : null;

  // 문서를 고른 상태는 언제나 문서 칸이다 — 초안 탭에서 초안을 눌러 와도
  // 그 문서가 보여야 한다.
  const tab: KnowledgeTab =
    selectedPath || !tabParam || !TAB_KEYS.has(tabParam as KnowledgeTab)
      ? "docs"
      : (tabParam as KnowledgeTab);

  // 탭 이름에 건수를 붙이므로 어느 칸에 있든 둘 다 필요하다. 전에는 문서를
  // 안 골랐을 때만 조회했는데, 그러면 문서를 보는 동안 숫자가 사라진다.
  const [gaps, proposals] = await Promise.all([
    listOpenGaps().then(groupGaps),
    listPendingProposals(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <KnowledgeTabs
        active={tab}
        reviewCount={proposals.length}
        gapCount={gaps.length}
      />

      {tab === "docs" ? (
        <section className="grid min-h-0 grid-cols-[280px_1fr] gap-6 p-7 max-md:grid-cols-1">
          <div className="min-h-0 border-r border-line pr-4 max-md:border-r-0 max-md:pr-0">
            <KnowledgeTree groups={groups} selected={selectedPath} />
          </div>

          <div className="min-w-0">
            {rows.length === 0 ? (
              <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
                아직 인덱싱된 문서가 없습니다. 자동화 페이지에서 <b>업무 지식망
                인덱싱</b>을 실행하거나, SharePoint 볼트에 문서를 추가해 주세요.
              </p>
            ) : doc ? (
              <KnowledgeDocView doc={doc} allPaths={rows.map((r) => r.path)} />
            ) : (
              <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
                좌측에서 문서를 선택하세요.
              </p>
            )}
          </div>
        </section>
      ) : (
        /* 나머지 칸은 트리가 필요 없다 — 긴 본문과 되묻기를 넓게 쓴다. */
        <section className="min-w-0 p-7">
          {tab === "draft" ? (
            <FileDraftForm />
          ) : tab === "review" ? (
            <PendingProposals proposals={proposals} />
          ) : (
            <KnowledgeGaps groups={gaps} />
          )}
        </section>
      )}
    </div>
  );
}
