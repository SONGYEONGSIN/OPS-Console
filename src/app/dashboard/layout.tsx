import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/features/auth/queries";
import { AuthTitleBar, AuthStatusBar } from "@/components/auth/AuthChrome";
import { Chrome } from "./_components/chrome/Chrome";
import { DashboardShell } from "./_components/DashboardShell";
import { LiveClock } from "./_components/LiveClock";
import { getPatternMockData } from "./_data/patterns";
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

  return (
    <DashboardShell
      topBar={<AuthTitleBar />}
      chrome={<Chrome operator={operator} alerts={alerts} />}
      appBar={<AppBar />}
      statusBar={<AuthStatusBar />}
    >
      {children}
    </DashboardShell>
  );
}

/* ════════════════════════════════════════════════════════════
   App bar — 모바일 전용 (≤767px). Chrome bar는 별도 epic.
   ════════════════════════════════════════════════════════════ */
function AppBar() {
  return (
    <header
      role="banner"
      className="relative z-30 hidden h-12 items-center gap-2 border-b border-line bg-washi px-3 max-md:flex"
    >
      <div className="flex-1 text-center text-md font-semibold tracking-[0.02em]">
        OPS Console
      </div>
      <LiveClock />
    </header>
  );
}

