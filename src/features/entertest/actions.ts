"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEntertestAccount } from "./queries";

export type EntertestActionState = { ok: boolean; message: string } | undefined;

const urlSchema = z
  .string()
  .url("올바른 URL이 아닙니다.")
  .refine((u) => u.includes("entertest.jinhakapply.com"), {
    message: "entertest.jinhakapply.com 주소만 허용됩니다.",
  });

/**
 * 테스트 실행 요청 — pending 1건 적재. 회사 PC 폴러가 claim해 실행한다.
 * 본인 테스트 계정 미등록이면 거부. 이미 대기/진행 중이면 중복 적재 방지.
 */
export async function requestEntertestRun(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsedUrl = urlSchema.safeParse(formData.get("targetUrl"));
  if (!parsedUrl.success) {
    return { ok: false, message: parsedUrl.error.issues[0].message };
  }

  const account = await getMyEntertestAccount(me.email);
  if (!account) {
    return {
      ok: false,
      message:
        "테스트 계정이 등록되지 않았습니다. 먼저 본인 계정을 등록하세요.",
    };
  }

  const admin = createAdminClient();
  const { data: existing, error: selErr } = await admin
    .from("entertest_test_runs")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return { ok: false, message: selErr.message };
  if (existing && existing.length > 0) {
    return {
      ok: false,
      message: "이미 대기/진행 중인 테스트가 있습니다. 완료를 기다려 주세요.",
    };
  }

  const { error } = await admin.from("entertest_test_runs").insert({
    requested_by: me.email,
    target_url: parsedUrl.data,
    test_account: account,
    status: "pending",
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/dev-test");
  return {
    ok: true,
    message: "테스트 실행을 요청했습니다. 회사 PC 폴러가 곧 실행합니다.",
  };
}

const accountSchema = z
  .string()
  .trim()
  .regex(/^jt\d{5}$/, "jt + 5자리 숫자 형식이어야 합니다 (예: jt29001).");

/** 본인 entertest 테스트 계정(ID=PW 동일) 등록/수정. */
export async function setMyEntertestAccount(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsed = accountSchema.safeParse(formData.get("account"));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("operators")
    .update({ entertest_account: parsed.data })
    .eq("email", me.email);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/dev-test");
  return { ok: true, message: "테스트 계정을 등록했습니다." };
}
