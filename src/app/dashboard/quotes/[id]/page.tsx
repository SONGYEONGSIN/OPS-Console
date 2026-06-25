import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getQuoteDocument } from "@/features/quotes/document-queries";
import { saveQuoteDocument } from "@/features/quotes/document-actions";
import { blankDocument } from "@/features/quotes/document-schema";
import { QuoteDocumentEditor } from "./_components/QuoteDocumentEditor";

export default async function QuoteDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("quotes");
  const { id } = await params;

  const data = await getQuoteDocument(id);
  if (!data) notFound();

  const quoteType = data.quoteType;
  const document = data.document ?? blankDocument(quoteType);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-6 md:px-6 lg:px-7">
        <QuoteDocumentEditor
          id={id}
          quoteType={quoteType}
          document={document}
          customer={data.customer}
          onSave={saveQuoteDocument}
        />
      </section>
    </div>
  );
}
