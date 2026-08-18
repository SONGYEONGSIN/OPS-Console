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

/**
 * 업무 지식망 열람 — 좌측 트리 + 우측 문서. 읽기 전용이고 편집은 옵시디언이 한다.
 * 목록·인스펙터 패턴을 쓰지 않는다 — 목록+상세가 아니라 문서 탐색이다.
 */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const slug = "knowledge";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const rows = await listKnowledgeDocs();
  const config = resolvePageMeta(slug, meta, rows.length);
  const groups = groupByCategory(rows);

  const { doc: docParam } = await searchParams;
  const selectedPath = docParam ?? null;
  const doc = selectedPath ? await getKnowledgeDoc(selectedPath) : null;

  // 문서를 안 골랐을 때만 필요하다 — 고른 상태에서 조회하면 헛일이다.
  const [gaps, proposals] = doc
    ? [[], []]
    : await Promise.all([
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
            /* 빈 칸에 "좌측에서 선택하세요"만 두느니, 무엇을 더 써야 하는지를 보여준다 */
            <KnowledgeGaps groups={gaps} proposals={proposals} />
          )}
        </div>
      </section>
    </div>
  );
}
