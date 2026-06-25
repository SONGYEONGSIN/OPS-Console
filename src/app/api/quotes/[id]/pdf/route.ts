import { renderToBuffer } from "@react-pdf/renderer";
import { getQuoteDocument } from "@/features/quotes/document-queries";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { blankDocument } from "@/features/quotes/document-schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = await getQuoteDocument(id);
  if (!q) return new Response("not found", { status: 404 });
  const document = q.document ?? blankDocument(q.quoteType);
  const buffer = await renderToBuffer(
    renderQuotePdf({ document, customer: q.customer }),
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${id}.pdf"`,
    },
  });
}
