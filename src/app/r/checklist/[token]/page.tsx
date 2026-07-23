import { notFound } from "next/navigation";
import { getRoundByToken } from "@/features/checklist/queries";
import { ReportBody } from "@/components/checklist/ReportBody";
import { FillForm } from "./_components/FillForm";
import { ReportView } from "./_components/ReportView";

/**
 * 체크리스트 공개 링크 — 인증 없이 토큰으로 조회. proxy PUBLIC_PATHS "/r" prefix 포함.
 * fill 토큰 → 전 부서 통합 작성 폼(쓰기), report 토큰 → 임원 보고 뷰(읽기). 무효/비활성 토큰 404.
 */
export default async function SharedChecklistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getRoundByToken(token);
  if (!data) notFound();
  const { round, items, token: tok } = data;

  if (tok.kind === "fill") {
    return (
      <main className="min-h-screen bg-paper">
        <FillForm
          token={tok.token}
          roundTitle={round.title}
          periodStart={round.periodStart}
          periodEnd={round.periodEnd}
          items={items}
        />
      </main>
    );
  }

  // report 토큰: AI 보고리포트(서술형 HTML)가 있으면 그걸, 없으면 항목 현황 뷰로 폴백.
  if (round.reportHtml) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <header className="mb-5 border-b-2 border-vermilion pb-3">
            <p className="text-xs uppercase tracking-[0.06em] text-muted">
              어플라이본부 원서접수 점검 보고리포트
            </p>
            <h1 className="mt-1 text-2xl font-bold text-ink">{round.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"}
            </p>
          </header>
          <ReportBody html={round.reportHtml} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <ReportView round={round} items={items} />
    </main>
  );
}
