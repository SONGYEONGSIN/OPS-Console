import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getRoundWithItems } from "@/features/checklist/queries";
import { ReportView } from "@/app/r/checklist/[token]/_components/ReportView";

/**
 * 관리자 보고리포트 (HTML) — 회차 상세의 '보고리포트' 버튼 대상.
 * 보고용 링크(ReportView)와 동일한 문서를 admin 라우트에서 바로 열람/인쇄(브라우저 Ctrl+P).
 * 메모 안의 표·이미지가 HTML로 그대로 렌더된다(PDF 대체).
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
  return (
    <div className="p-5 md:p-6 lg:p-7">
      <Link
        href={`/dashboard/checklist/${id}`}
        className="mb-4 inline-block text-sm text-muted hover:underline"
      >
        ← 회차 상세
      </Link>
      <ReportView round={data.round} items={data.items} />
    </div>
  );
}
