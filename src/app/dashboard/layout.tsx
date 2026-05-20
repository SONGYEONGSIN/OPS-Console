import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/features/auth/queries";
import { filterSidebarSections } from "@/features/auth/permission";
import { AuthTitleBar, AuthStatusBar } from "@/components/auth/AuthChrome";
import { AppBar } from "./_components/AppBar";
import { Chrome } from "./_components/chrome/Chrome";
import { DashboardShell } from "./_components/DashboardShell";
import { sidebarSections } from "./_data";
import { applyDynamicSidebarCounts } from "./_data/sidebar-helpers";
import { getMenuCounts } from "@/features/menu-counts/queries";
import { getOpsAlerts } from "@/features/alerts/queries";

/**
 * dashboard 셸 — 모든 /dashboard 하위 라우트 공통.
 * - Server component: getCurrentOperator + alerts mock 페치
 * - Chrome (데스크탑) / AppBar (모바일) / StatusBar / DashboardShell(client wrapper)
 * - sidebar drawer state는 DashboardShell이 보유
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const operator = await getCurrentOperator();
  if (!operator) redirect("/login");

  const alerts = await getOpsAlerts(operator.email);

  // 실 row count로 hardcode count 덮어쓰기 (DB 연동 도메인만)
  const counts = await getMenuCounts(operator.email);
  const dynamicSections = applyDynamicSidebarCounts(sidebarSections, counts);

  // 사용자 권한 기반 사이드바 필터 — admin은 전체, member는 allowed_menus만
  const sections = filterSidebarSections(dynamicSections, operator);

  return (
    <DashboardShell
      topBar={<AuthTitleBar />}
      chrome={<Chrome operator={operator} alerts={alerts} />}
      appBar={<AppBar />}
      statusBar={<AuthStatusBar />}
      sections={sections}
      me={operator}
    >
      {children}
    </DashboardShell>
  );
}

