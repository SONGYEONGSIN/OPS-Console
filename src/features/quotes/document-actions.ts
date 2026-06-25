"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  blankDocument,
  quoteDocumentSchema,
  quoteTypeSchema,
  type QuoteDocument,
  type QuoteType,
} from "./document-schema";
import { recomputeDocument } from "./calc";

const KST_TODAY = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export async function createQuoteWithType(
  type: QuoteType,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const tp = quoteTypeSchema.safeParse(type);
  if (!tp.success) return { ok: false, error: "잘못된 견적 유형입니다." };

  const document = recomputeDocument(blankDocument(tp.data));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      quote_type: tp.data,
      document,
      amount: document.totals.total,
      customer: "",
      quote_date: KST_TODAY(),
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/quotes");
  return { ok: true, id: data.id as string };
}

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
