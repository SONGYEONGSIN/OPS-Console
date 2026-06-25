"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  quoteDocumentSchema,
  quoteTypeSchema,
  type QuoteDocument,
  type QuoteType,
} from "./document-schema";
import { recomputeDocument } from "./calc";

export async function saveQuoteDocument(
  id: string,
  document: QuoteDocument,
  quoteType: QuoteType,
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const tp = quoteTypeSchema.safeParse(quoteType);
  if (!tp.success) return { ok: false, error: "잘못된 견적 유형입니다." };
  const parsed = quoteDocumentSchema.safeParse(document);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };

  // 서버 재계산(클라이언트 값 불신) → amount 동기화
  const recomputed = recomputeDocument(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      quote_type: tp.data,
      document: recomputed,
      amount: recomputed.totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${id}`);
  return { ok: true };
}
