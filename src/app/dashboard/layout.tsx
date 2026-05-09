import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/features/auth/queries";
import { AuthTitleBar } from "@/components/auth/AuthChrome";
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
      statusBar={<StatusBar />}
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

/* ════════════════════════════════════════════════════════════
   Status bar — 시스템 정보만. 알림은 Chrome 우측에 일원화됨.
   ════════════════════════════════════════════════════════════ */
function StatusBar() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-ink px-4 text-2xs tracking-[0.08em] text-cream max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[25] max-md:h-6 max-md:px-3 max-md:text-xs">
      <div className="flex items-center gap-[18px] max-md:gap-3">
        <span className="opacity-75">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage align-middle [box-shadow:var(--shadow-led-sage)]" />
          <span className="text-xs tracking-normal">연결됨</span>
        </span>
        <span className="opacity-75 max-md:hidden">
          <strong className="font-medium opacity-100">브랜치</strong> main
        </span>
        <span className="opacity-75">
          <strong className="font-medium opacity-100">
            <span className="text-xs tracking-normal">동기화</span>
          </strong>{" "}
          <span className="text-xs tracking-normal">12초 전</span>
        </span>
      </div>
      <div className="flex items-center justify-center gap-[18px] max-md:hidden">
        <span className="opacity-75">
          <span className="text-xs tracking-normal">
            MS-2026-042 · 14,280 단어 · 47페이지 · 한/영
          </span>
        </span>
      </div>
      <div className="flex items-center justify-end gap-[18px] max-md:gap-3">
        <span className="opacity-75 max-md:hidden">v 4.2.1</span>
      </div>
    </div>
  );
}
