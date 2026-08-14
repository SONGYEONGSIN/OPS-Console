"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { findServiceAdmissionType, getMyEntertestAccount } from "./queries";
import { buildEntertestTargetUrl } from "./target-url";

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

  const account = await getMyEntertestAccount(me.email);
  if (!account) {
    return {
      ok: false,
      message:
        "테스트 계정이 등록되지 않았습니다. 먼저 본인 계정을 등록하세요.",
    };
  }

  // 접수구분에 따라 테스트 시스템(entertest/nstest)이 갈린다.
  // 모르는 채로 적재하면 폴러가 엉뚱한 시스템을 열게 되므로 여기서 멈춘다.
  const service = await findServiceAdmissionType(serviceId);
  if (!service) {
    return {
      ok: false,
      message: "서비스 정보를 찾을 수 없습니다. 목록을 새로고침해 주세요.",
    };
  }
  const targetUrl = buildEntertestTargetUrl(serviceId, service.admissionType);

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

const runIdSchema = z.string().uuid();

/**
 * 대기 중인 테스트 요청 취소 — 요청자 본인 또는 admin만.
 *
 * 대기/진행 1건 정책 때문에 pending이 남아 있으면 아무도 새 테스트를 못 돌린다.
 * 폴러 claim(pending → running)과 경합하므로 조회 후 삭제가 아니라
 * status·요청자 조건을 DELETE 필터에 함께 걸어 한 번에 처리한다 —
 * 그 사이 claim됐다면 지워지는 행이 0건이 되어 실패로 돌아온다.
 * 실행되지 않은 요청이라 남길 결과가 없어 행을 지운다.
 */
export async function cancelEntertestRun(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsedId = runIdSchema.safeParse(formData.get("runId"));
  if (!parsedId.success) {
    return { ok: false, message: "취소할 요청을 찾을 수 없습니다." };
  }

  const admin = createAdminClient();
  let query = admin
    .from("entertest_test_runs")
    .delete()
    .eq("id", parsedId.data)
    .eq("status", "pending");
  if (me.permission !== "admin") {
    query = query.eq("requested_by", me.email);
  }
  const { data, error } = await query.select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      message:
        "취소할 수 없습니다. 이미 실행이 시작됐거나 본인 요청이 아닙니다.",
    };
  }

  revalidatePath("/dashboard/dev-test");
  return { ok: true, message: "대기 중인 요청을 취소했습니다." };
}

/**
 * 끝난 실행 이력 삭제 — 실패·오류 건만. 요청자 본인 또는 admin.
 *
 * 완료(done)는 남길 가치가 있는 성공 기록이라 지우지 않고, 실행 중(running)은
 * 폴러가 돌고 있어 손대지 않는다. 대기(pending) 취소는 cancelEntertestRun.
 * 취소와 같은 이유로 status·요청자 조건을 DELETE 필터에 함께 건다.
 */
export async function deleteEntertestRun(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsedId = runIdSchema.safeParse(formData.get("runId"));
  if (!parsedId.success) {
    return { ok: false, message: "삭제할 이력을 찾을 수 없습니다." };
  }

  const admin = createAdminClient();
  let query = admin
    .from("entertest_test_runs")
    .delete()
    .eq("id", parsedId.data)
    .in("status", ["failed", "error"]);
  if (me.permission !== "admin") {
    query = query.eq("requested_by", me.email);
  }
  const { data, error } = await query.select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      message:
        "삭제할 수 없습니다. 실패·오류 건이 아니거나 본인 요청이 아닙니다.",
    };
  }

  revalidatePath("/dashboard/dev-test");
  return { ok: true, message: "실행 이력을 삭제했습니다." };
}

const accountSchema = z
  .string()
  .trim()
  .regex(/^jt\d{5}$/, "jt + 5자리 숫자 형식이어야 합니다 (예: jt29001).");

/**
 * 테스트 대역 계정 등록/수정 — 시작~끝 범위. 끝이 비거나 같으면 단일 계정.
 * "jt29001~jt29005"(범위) 또는 "jt29001"(단일)로 entertest_account에 저장.
 */
export async function setMyEntertestAccount(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const start = accountSchema.safeParse(formData.get("account_start"));
  if (!start.success) {
    return { ok: false, message: `시작 계정: ${start.error.issues[0].message}` };
  }
  let account = start.data;
  const endRaw = formData.get("account_end");
  const endStr = typeof endRaw === "string" ? endRaw.trim() : "";
  if (endStr) {
    const end = accountSchema.safeParse(endStr);
    if (!end.success) {
      return { ok: false, message: `끝 계정: ${end.error.issues[0].message}` };
    }
    if (end.data !== start.data) account = `${start.data}~${end.data}`;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("operators")
    .update({ entertest_account: account })
    .eq("email", me.email);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/dev-test");
  return { ok: true, message: "테스트 대역 계정을 등록했습니다." };
}
