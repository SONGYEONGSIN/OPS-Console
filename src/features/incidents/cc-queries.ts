import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAssignmentSheet,
  SHEET_NAMES,
} from "@/features/assignments/queries";
import { findUniversitySales, pickIncidentCc, type CcOperator } from "./cc";

export type LoadedIncidentCc = {
  cc: { email: string; name: string }[];
  /** 참조를 다 못 채운 사정 — 발송은 막지 않고 활동 로그에 남긴다. */
  note: string | null;
};

/**
 * 사고보고 메일 참조 — 배정리스트(총괄장)에서 대분류·영업자를 읽고 조직권한에서 메일을 찾는다.
 * 대학명이 비었으면 시트를 안 연다.
 */
export async function loadIncidentCc(
  universityName: string | null,
  reporterEmail: string,
): Promise<LoadedIncidentCc> {
  if (!universityName) return { cc: [], note: null };

  const sheet = await fetchAssignmentSheet(SHEET_NAMES.배정리스트);
  if (!sheet) return { cc: [], note: "배정리스트를 읽지 못해 참조 없이 보냄" };

  const { data, error } = await createAdminClient()
    .from("operators")
    .select("email, name, team, role, status");
  if (error) {
    return {
      cc: [],
      note: `운영자 명단 조회 실패로 참조 없이 보냄: ${error.message}`,
    };
  }

  const picked = pickIncidentCc({
    sales: findUniversitySales(sheet, universityName),
    operators: (data ?? []) as CcOperator[],
    reporterEmail,
  });
  return {
    cc: picked.cc,
    note: picked.unmatchedSales
      ? `영업자 ${picked.unmatchedSales} — 조직권한 영업팀에 없음`
      : null,
  };
}
