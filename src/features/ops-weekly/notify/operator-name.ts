import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** 메일에 적을 사람 이름 — 운영자 명단에 없으면 이메일 그대로(빈칸으로 두지 않는다). */
export async function operatorNameOf(email: string): Promise<string> {
  const res = await createAdminClient()
    .from("operators")
    .select("name")
    .ilike("email", email)
    .limit(1);
  const name = ((res.data ?? []) as { name: string }[])[0]?.name?.trim();
  return name || email;
}
