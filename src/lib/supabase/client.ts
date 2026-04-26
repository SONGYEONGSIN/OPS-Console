import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * 컴포넌트 안에서 호출 시 마다 새 인스턴스 생성 — 싱글턴화 X (실시간 구독 누수 방지).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
