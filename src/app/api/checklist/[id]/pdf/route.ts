import { NextResponse } from "next/server";
import { getRoundWithItems } from "@/features/checklist/queries";
import { renderChecklistPdf } from "@/lib/pdf/checklist-pdf";

/**
 * 체크리스트 회차 PDF — 로그인 필요(proxy 가드 + getRoundWithItems RLS authenticated).
 * reports PDF 라우트와 동일 패턴.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const data = await getRoundWithItems(id);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const pdf = await renderChecklistPdf(data.round, data.items);
  const safeTitle = data.round.title
    .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "_")
    .slice(0, 60);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
    },
  });
}
