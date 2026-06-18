import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listEntertestRuns,
  getMyEntertestAccount,
} from "@/features/entertest/queries";
import { DevTestClient } from "./DevTestClient";

/**
 * /dashboard/dev-test — entertest 원서접수 케이스별 테스트 자동화.
 * 운영자가 URL+본인 계정으로 실행 요청 → 회사 PC 폴러가 실행 → 이력/상세 표시.
 * 정적 세그먼트라 [slug] list 패턴을 오버라이드한다.
 */
export default async function DevTestPage() {
  const slug = "dev-test";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const me = await getCurrentOperator();
  const [runs, myAccount] = await Promise.all([
    listEntertestRuns(50),
    me ? getMyEntertestAccount(me.email) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <DevTestClient runs={runs} myAccount={myAccount} />
    </div>
  );
}
