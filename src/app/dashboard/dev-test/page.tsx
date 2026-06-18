import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listEntertestRuns,
  listTestableServices,
  getMyEntertestAccount,
} from "@/features/entertest/queries";
import { DevTestClient } from "./DevTestClient";

/**
 * /dashboard/dev-test — closing_services 기반 서비스 선택 + 테스트 자동화.
 * 좌측: 서비스 목록(칩/셀렉트 필터 + 검색 + 클라이언트 페이지네이션).
 * 우측: 선택 서비스의 테스트 URL, 테스트 계정 등록/수정, 테스트 실행, 실행 로그.
 */
export default async function DevTestPage() {
  const slug = "dev-test";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const me = await getCurrentOperator();
  const [services, runs, myAccount] = await Promise.all([
    listTestableServices(),
    listEntertestRuns(200),
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
      <DevTestClient services={services} runs={runs} myAccount={myAccount} />
    </div>
  );
}
