import { notFound } from "next/navigation";
import { getReportByShareToken } from "@/features/reports/queries";
import { KpiCard } from "@/app/dashboard/reports/_components/KpiCard";

/**
 * 인증 없이 토큰으로 리포트 조회. proxy.ts PUBLIC_PATHS에 "/r" 등록됨.
 * 토큰 유효 시 KPI 카드 재현, 무효 시 404.
 * - 다운로드/공유 컨트롤 없음 (게스트 view)
 * - admin이 share_token 해제하면 즉시 404
 */
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByShareToken(token);
  if (!report) notFound();

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <header className="border-b border-line pb-4">
          <p className="text-xs uppercase tracking-[0.06em] text-muted">
            [운영부 상황실] 운영리포트 공유 view
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">
            {report.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {report.periodStart} ~ {report.periodEnd}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {report.kpis.map((k) => (
            <KpiCard key={k.key} item={k} />
          ))}
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">
          본 페이지는 외부 공유 링크입니다. 링크가 비활성화되면 조회할 수
          없습니다.
        </footer>
      </div>
    </main>
  );
}
