import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getRoundWithItems } from "@/features/checklist/queries";
import { ReportDocument } from "./_components/ReportDocument";

/**
 * 관리자 보고리포트 (HTML) — 회차 상세의 '보고리포트' 버튼 대상.
 * 작성된 전체 내용을 claude로 정리한 서술형 보고 문서를 열람/생성한다.
 * (확인용 링크의 항목·상태 나열과 별개인 '보고 문서'. 브라우저 인쇄로 PDF화 가능)
 */
export default async function ChecklistReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("checklist");
  const { id } = await params;
  const data = await getRoundWithItems(id);
  if (!data) notFound();
  const { round } = data;

  return (
    <div className="p-5 md:p-6 lg:p-7">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/dashboard/checklist/${id}`}
          className="mb-2 inline-block text-sm text-muted hover:underline"
        >
          ← 회차 상세
        </Link>
        <header className="mb-5 border-b-2 border-vermilion pb-3">
          <p className="text-xs uppercase tracking-[0.06em] text-muted">
            어플라이본부 원서접수 점검 보고리포트
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{round.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"}
          </p>
        </header>
        <ReportDocument round={round} />
      </div>
    </div>
  );
}
