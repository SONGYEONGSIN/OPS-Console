import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name === "host") return "localhost:3001";
      if (name === "x-forwarded-proto") return "http";
      return null;
    },
  })),
  cookies: vi.fn(),
}));

import { signIn, signOut, signUp, forgotPassword, resetPassword } from "./actions";
import { createClient } from "@/lib/supabase/server";

const mockCreate = createClient as unknown as ReturnType<typeof vi.fn>;

describe("signIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 이메일이면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "");
    fd.set("password", "pw");
    const result = await signIn(undefined, fd);
    expect(result).toEqual({ error: "이메일을 입력해주세요." });
  });

  it("이메일 형식 잘못되면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("password", "pw");
    const result = await signIn(undefined, fd);
    expect(result).toEqual({ error: "이메일 형식이 올바르지 않습니다." });
  });

  it("빈 비밀번호면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "");
    const result = await signIn(undefined, fd);
    expect(result).toEqual({ error: "비밀번호를 입력해주세요." });
  });

  it("Supabase 'Invalid login credentials' → 한국어 매핑", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" },
        }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "wrong");
    const result = await signIn(undefined, fd);
    expect(result).toEqual({
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  });

  it("Supabase 'Email not confirmed' → 한국어 매핑", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Email not confirmed" },
        }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "x");
    const result = await signIn(undefined, fd);
    expect(result).toEqual({
      error: "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.",
    });
  });

  it("성공 시 /dashboard로 redirect", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "right");
    await expect(signIn(undefined, fd)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("remember=on이면 createClient에 {rememberMe: true} 전달", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "right");
    fd.set("remember", "on");
    await expect(signIn(undefined, fd)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockCreate).toHaveBeenCalledWith({ rememberMe: true });
  });

  it("remember 없으면 createClient에 {rememberMe: false} 전달", async () => {
    mockCreate.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "right");
    // remember 미설정
    await expect(signIn(undefined, fd)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockCreate).toHaveBeenCalledWith({ rememberMe: false });
  });
});

describe("signOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Supabase signOut 호출 후 /login으로 redirect", async () => {
    const signOutSpy = vi.fn().mockResolvedValue({});
    mockCreate.mockResolvedValue({
      auth: {
        signOut: signOutSpy,
      },
    });
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(signOutSpy).toHaveBeenCalledOnce();
  });
});

describe("signUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 이메일이면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "이메일을 입력해주세요." });
  });

  it("이메일 형식 잘못되면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "이메일 형식이 올바르지 않습니다." });
  });

  it("화이트리스트에 없는 이메일이면 거부", async () => {
    const fd = new FormData();
    fd.set("email", "outsider@example.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "허용된 이메일이 아닙니다." });
  });

  it("비밀번호 8자 미만이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "alcure23@jinhakapply.com");
    fd.set("password", "Aa1!aa");
    fd.set("passwordConfirm", "Aa1!aa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 대문자 누락이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "alcure23@jinhakapply.com");
    fd.set("password", "aa1!aaaa");
    fd.set("passwordConfirm", "aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "영문 대문자를 포함해야 합니다." });
  });

  it("비밀번호 확인 불일치면 refine 에러", async () => {
    const fd = new FormData();
    fd.set("email", "alcure23@jinhakapply.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Bb2@bbbb");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "비밀번호 확인이 일치하지 않습니다." });
  });

  it("성공 시 Supabase signUp 호출 + info 반환", async () => {
    const signUpSpy = vi.fn().mockResolvedValue({
      data: { user: { identities: [{ id: "i1" }] } },
      error: null,
    });
    mockCreate.mockResolvedValue({ auth: { signUp: signUpSpy } });
    const fd = new FormData();
    fd.set("email", "alcure23@jinhakapply.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(signUpSpy).toHaveBeenCalledWith({
      email: "alcure23@jinhakapply.com",
      password: "Aa1!aaaa",
    });
    expect(result).toEqual({
      info: "확인 메일을 발송했습니다. 메일함을 확인해주세요.",
    });
  });

  it("이미 가입된 이메일 (identities.length=0) → 에러 반환", async () => {
    // Supabase enumeration 방지: 이미 가입된 이메일이어도 error 없이 응답.
    // identities=[] 가 그 신호 — 메일 안 보냄.
    const signUpSpy = vi.fn().mockResolvedValue({
      data: { user: { id: "x", identities: [] } },
      error: null,
    });
    mockCreate.mockResolvedValue({ auth: { signUp: signUpSpy } });
    const fd = new FormData();
    fd.set("email", "alcure23@jinhakapply.com");
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    const result = await signUp(undefined, fd);
    expect(result).toEqual({ error: "이미 가입된 이메일입니다." });
  });
});

describe("forgotPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 이메일이면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("email", "");
    const result = await forgotPassword(undefined, fd);
    expect(result).toEqual({ error: "이메일을 입력해주세요." });
  });

  it("이메일 형식 잘못되면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("email", "not-an-email");
    const result = await forgotPassword(undefined, fd);
    expect(result).toEqual({ error: "이메일 형식이 올바르지 않습니다." });
  });

  it("정상 이메일 시 resetPasswordForEmail 호출 + info 반환 (enumeration 방지)", async () => {
    const resetSpy = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { resetPasswordForEmail: resetSpy } });
    const fd = new FormData();
    fd.set("email", "user@example.com");
    const result = await forgotPassword(undefined, fd);
    expect(resetSpy).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "http://localhost:3001/auth/callback?next=/reset-password",
    });
    expect(result).toEqual({
      info: "재설정 링크를 발송했습니다. 메일함을 확인해주세요.",
    });
  });
});

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 비밀번호면 zod 에러 반환", async () => {
    const fd = new FormData();
    fd.set("password", "");
    fd.set("passwordConfirm", "");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 8자 미만이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("password", "Aa1!aa");
    fd.set("passwordConfirm", "Aa1!aa");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호는 8자 이상이어야 합니다." });
  });

  it("비밀번호 대문자 누락이면 zod 에러", async () => {
    const fd = new FormData();
    fd.set("password", "aa1!aaaa");
    fd.set("passwordConfirm", "aa1!aaaa");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "영문 대문자를 포함해야 합니다." });
  });

  it("비밀번호 확인 불일치면 refine 에러", async () => {
    const fd = new FormData();
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Bb2@bbbb");
    const result = await resetPassword(undefined, fd);
    expect(result).toEqual({ error: "비밀번호 확인이 일치하지 않습니다." });
  });

  it("성공 시 updateUser 호출 + /dashboard로 redirect", async () => {
    const updateSpy = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { updateUser: updateSpy } });
    const fd = new FormData();
    fd.set("password", "Aa1!aaaa");
    fd.set("passwordConfirm", "Aa1!aaaa");
    await expect(resetPassword(undefined, fd)).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(updateSpy).toHaveBeenCalledWith({ password: "Aa1!aaaa" });
  });
});
