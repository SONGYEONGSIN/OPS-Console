import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/features/auth/queries";
import { filterSidebarSections } from "@/features/auth/permission";
import { AuthTitleBar, AuthStatusBar } from "@/components/auth/AuthChrome";
import { AppBar } from "./_components/AppBar";
import { Chrome } from "./_components/chrome/Chrome";
import { DashboardShell } from "./_components/DashboardShell";
import { getPatternMockData } from "./_data/patterns";
import { sidebarSections } from "./_data";
import type { DashWidget } from "./_components/patterns/DashPattern";

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

  const alerts = (
    getPatternMockData("alerts", "dash") as { widgets: DashWidget[] }
  ).widgets;

  // 사용자 권한 기반 사이드바 필터 — admin은 전체, member는 allowed_menus만
  const sections = filterSidebarSections(sidebarSections, operator);

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

