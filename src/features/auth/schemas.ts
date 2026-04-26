import { z } from "zod";
import { ALLOWED_EMAILS } from "./operators";

// 비밀번호 강도 정책 (signUp / resetPassword 공유). 변경 시 단일 source.
const strongPasswordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .regex(/[A-Z]/, "영문 대문자를 포함해야 합니다.")
  .regex(/[0-9]/, "숫자를 포함해야 합니다.")
  .regex(
    /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/,
    "특수문자를 포함해야 합니다."
  );

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요.")
    .email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "이메일을 입력해주세요.")
      .email("이메일 형식이 올바르지 않습니다.")
      .refine((email) => ALLOWED_EMAILS.has(email), {
        message: "허용된 이메일이 아닙니다.",
      }),
    password: strongPasswordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요.")
    .email("이메일 형식이 올바르지 않습니다."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
