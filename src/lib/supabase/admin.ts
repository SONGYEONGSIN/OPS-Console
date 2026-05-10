import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role admin client — Auth admin API + RLS bypass용.
 *
 * 주의:
 * - 절대 client component에서 import 금지 ('server-only' 가드)
 * - cookie/session 사용 안 함 — autoRefreshToken: false, persistSession: false
 * - SUPABASE_SERVICE_ROLE_KEY 누출 시 모든 RLS 무력화 → 환경 변수 관리 엄격
 *
 * 사용처: onboarding invite 발송, e2e cleanup script 등 admin 권한 필요 작업.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[admin client] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경 변수 필요",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
