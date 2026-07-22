import { notFound } from "next/navigation";
import { getRoundByToken } from "@/features/checklist/queries";
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

  return (
    <main className="min-h-screen bg-paper">
      <ReportView round={round} items={items} />
    </main>
  );
}
