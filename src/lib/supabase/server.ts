import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client.
 *
 * @param options.rememberMe — login 시 cookie 정책:
 *   - `true`: maxAge 14일 (이 기기 기억 체크 시)
 *   - `false`: maxAge undefined → session cookie (체크 미체크 시)
 *   - 미지정 (default): Supabase 기본 동작 (middleware/dashboard 등 일반 호출자)
 */
export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              const finalOptions =
                options?.rememberMe === true
                  ? { ...cookieOptions, maxAge: 14 * 24 * 3600 }
                  : options?.rememberMe === false
                    ? { ...cookieOptions, maxAge: undefined }
                    : cookieOptions;
              cookieStore.set(name, value, finalOptions);
            });
          } catch {
            // Server Component에서 cookie set 호출 시 에러 — middleware로 처리되므로 무시
          }
        },
      },
    }
  );
}
