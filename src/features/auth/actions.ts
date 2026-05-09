"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from "./schemas";

export type AuthState = { error?: string; info?: string } | undefined;

/**
 * Supabase 영문 에러 → 한국어 메시지.
 * 매핑되지 않은 에러는 generic 메시지로 통합 (영문 노출 방지).
 * enumeration 방지: '비밀번호 틀림' vs '미가입' 구분 안 함 — 통합 메시지.
 */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Email not confirmed":
      "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.",
    "User already registered": "이미 가입된 이메일입니다.",
    "Email rate limit exceeded":
      "메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "New password should be different from the old password.":
      "새 비밀번호는 이전 비밀번호와 달라야 합니다.",
  };
  if (map[message]) return map[message];
  if (/rate limit|too many requests/i.test(message)) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const remember = formData.get("remember") === "on";
  const supabase = await createClient({ rememberMe: remember });
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: translateAuthError(error.message) };

  // Supabase는 이미 가입된 이메일에 대해 enumeration 방지로 error 없이 응답하지만
  // identities 배열이 비어있음 — 이 경우 실제 메일은 안 감. 명시적으로 알림.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "이미 가입된 이메일입니다." };
  }

  return { info: "확인 메일을 발송했습니다. 메일함을 확인해주세요." };
}

export async function forgotPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  // 보안: 가입 여부 enumeration 방지 — 에러 결과와 무관하게 동일 info 반환.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요." };
}

export async function resetPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { error: translateAuthError(error.message) };

  // 비밀번호 변경 후엔 자동 로그인하지 않고 로그인 페이지로 보내 새 비밀번호로 다시 로그인하게 함.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?info=password_changed");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
