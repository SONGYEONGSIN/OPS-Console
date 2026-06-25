import "server-only";
import { createClient } from "@/lib/supabase/server";
import { quoteDocumentSchema, type QuoteDocument, type QuoteType } from "./document-schema";

export async function getQuoteDocument(
  id: string,
): Promise<{ id: string; quoteType: QuoteType; document: QuoteDocument | null; customer: string; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_type, document, customer, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = quoteDocumentSchema.safeParse(data.document);
  return {
    id: data.id as string,
    quoteType: (data.quote_type as QuoteType) ?? "dev",
    document: parsed.success ? parsed.data : null,
    customer: (data.customer as string) ?? "",
    status: (data.status as string) ?? "draft",
  };
}
