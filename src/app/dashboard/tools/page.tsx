import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { redirect } from "next/navigation";
import { loadToolBoard } from "@/features/dev-tools/queries";
import { PageTabs } from "@/components/common/PageTabs";
import { ToolsClient } from "./_components/ToolsClient";
import type { ToolKind } from "@/features/dev-tools/scan";

/**
 * 도구 — 에이전트가 쓰는 스킬·훅·룰을 한곳에서 본다.
 *
 * 목록은 레포 `.claude/` 를 훑어 만든 카탈로그다(`npm run tools:scan`). MCP·플러그인은
 * 없는데, 둘 다 `~/.claude.json`·`~/.claude/settings.json` 에 있어 git 에 안 들어오고
 * Vercel 은 홈 디렉터리를 볼 수 없기 때문이다.
 */
const TABS = [
  { key: "skill", label: "스킬", href: "/dashboard/tools?tab=skill" },
  { key: "agent", label: "에이전트", href: "/dashboard/tools?tab=agent" },
  { key: "hook", label: "훅", href: "/dashboard/tools?tab=hook" },
  { key: "rule", label: "룰", href: "/dashboard/tools?tab=rule" },
] as const;

const KINDS: ToolKind[] = ["skill", "agent", "hook", "rule"];

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = "tools";
  const me = await requireMenu(slug);
  // 개발 환경 설정이라 admin 만 본다. 사이드바에서도 가려지지만, 주소를 직접
  // 치고 들어올 수 있어 여기서도 막는다.
  if (me.permission !== "admin") redirect("/dashboard");

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const tab = (KINDS as string[]).includes(sp.tab ?? "")
    ? (sp.tab as ToolKind)
    : "skill";

  const board = await loadToolBoard();
  const config = resolvePageMeta(slug, meta, board.rows.length);

  return (
    <>
      <PageHeader
        pathname={`/dashboard/${slug}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <PageTabs active={tab} tabs={TABS} />
      <div className="p-5 lg:p-7">
        <ToolsClient board={board} kind={tab} />
      </div>
    </>
  );
}
