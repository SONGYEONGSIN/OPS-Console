"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEntertestAccount } from "./queries";

export type EntertestActionState = { ok: boolean; message: string } | undefined;

const serviceIdSchema = z.coerce.number().int().positive();

/**
 * 테스트 실행 요청 — 선택 서비스(service_id)로 entertest URL을 유도해 pending 적재.
 * 본인 테스트 계정 미등록이면 거부. 이미 대기/진행 중이면 중복 적재 방지.
 */
export async function requestEntertestRun(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsedId = serviceIdSchema.safeParse(formData.get("serviceId"));
  if (!parsedId.success) {
    return { ok: false, message: "테스트할 서비스를 선택하세요." };
  }
  const serviceId = parsedId.data;
  const targetUrl = `https://entertest.jinhakapply.com/Notice/${serviceId}/A`;

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
    target_url: targetUrl,
    test_account: account,
    status: "pending",
    service_id: serviceId,
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
