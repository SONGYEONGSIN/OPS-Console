"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import type { AdmissionType } from "./admission-type-parse";

export type SaveAdmissionTypesResult =
  | { ok: true; saved: number }
  | { ok: false; error: string };

/**
 * 전형 이름표 저장 — **admin 만**.
 *
 * 이 표가 학교에 나가는 명세서의 전형 이름을 정한다. 틀리면 대학 담당자가
 * 남의 전형 설정을 자기 것으로 읽는다 — 화면이 admin 전용이더라도 서버가
 * 폼을 믿지 않고 여기서 다시 막는다.
 */
export async function saveAdmissionTypes(
  serviceId: number,
  rows: AdmissionType[],
): Promise<SaveAdmissionTypesResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: "admin만 저장할 수 있습니다" };
  }
  if (!Number.isInteger(serviceId) || rows.length === 0) {
    return { ok: false, error: "저장할 전형이 없습니다" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("dev_control_admission_types").upsert(
    rows.map((r) => ({
      service_id: serviceId,
      sel_type_code: r.selTypeCode,
      univ_code: r.univCode || null,
      name: r.name,
      updated_at: new Date().toISOString(),
      updated_by: me.email,
    })),
    { onConflict: "service_id,sel_type_code" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/dev-test");
  return { ok: true, saved: rows.length };
}
