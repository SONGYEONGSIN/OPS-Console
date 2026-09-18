import "server-only";
import { createClient } from "@/lib/supabase/server";
import { operatorRowSchema, type OperatorRow } from "./schemas";

/**
 * 조회에 쓰는 클라이언트. **세션 클라이언트와 service_role 클라이언트가 둘 다 온다** —
 * 화면은 세션으로 읽고, **자동화 잡에는 쿠키가 없어** service_role 로 읽어야 한다.
 *
 * 실측(2026-09-18): `operators` 의 select 정책이 `to authenticated` 라 세션 없는
 * 클라이언트는 **코드도 메시지도 빈 에러**를 받는다 — 여기서 `[]` 로 삼켜지면
 * 명부가 비어 보이고, 그걸로 만든 판단이 조용히 틀린다.
 */
type OperatorQueryClient = Pick<
  Awaited<ReturnType<typeof createClient>>,
  "from"
>;

/**
 * 운영부 조직 전체 fetch (RSC).
 * RLS: authenticated → 모든 row read.
 */
export async function listOperators(
  client?: OperatorQueryClient,
): Promise<OperatorRow[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .order("team", { ascending: true })
    .order("hired_at", { ascending: true });

  if (error) {
    console.error("[listOperators] supabase error:", error);
    return [];
  }

  const parsed: OperatorRow[] = [];
  for (const row of data ?? []) {
    const r = operatorRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listOperators] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

/**
 * 삭제된 operators만 fetch — 별도 보기 페이지에 사용.
 */
export async function listDeletedOperators(): Promise<OperatorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .eq("status", "deleted")
    .order("deleted_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[listDeletedOperators] supabase error:", error);
    return [];
  }
  const parsed: OperatorRow[] = [];
  for (const row of data ?? []) {
    const r = operatorRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
  }
  return parsed;
}

export async function getOperatorById(id: string): Promise<OperatorRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const r = operatorRowSchema.safeParse(data);
  return r.success ? r.data : null;
}
