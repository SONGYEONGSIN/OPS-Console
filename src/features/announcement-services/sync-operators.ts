"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { fetchAssignmentSheet, SHEET_NAMES } from "@/features/assignments/queries";
import {
  parseBaejungList,
  parseSimpleSheet,
  parsePims,
} from "@/features/assignments/parse";
import { matchOperators, type AssignRow } from "./operator-match";

/**
 * 합격자발표 서비스에 담당 운영자를 채운다 — 총괄장에서 이름으로 맞춰서.
 *
 * 이 표는 붙여넣기로 들어온 자료라 운영자 컬럼이 없었다. 성과 4갈래 중 이 갈래만
 * 원천적으로 개인 귀속이 불가능했던 이유다.
 *
 * **못 맞춘 건 목록으로 돌려준다.** 실측 58/87 — 남은 29는 초중고(총괄장은 대학
 * 배정표라 아예 없다)·캠퍼스 접미사·총괄장에 없는 대학이다. 0으로 삼키면 그
 * 대학들의 성과가 조용히 사라진다.
 *
 * PIMS 시트를 먼저 본다 — 합격자통합관리시스템이 곧 PIMS라 가장 정확한 배정이다.
 */
export type SyncResult =
  | { ok: true; matched: number; updated: number; unmatched: string[] }
  | { ok: false; error: string };

export async function syncAnnouncementOperators(): Promise<SyncResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: "admin만 실행할 수 있습니다" };
  }

  // PIMS 우선 — 합통이 곧 PIMS다. 없으면 학부·대학원 배정으로 떨어진다.
  const [pims, baejung, grad] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
  ]);
  const rows: AssignRow[] = [
    ...(pims ? parsePims(pims) : []),
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(grad
      ? parseSimpleSheet(grad, "대학원", {
          uni: /대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
  ].map((r) => ({ university: r.university, operator: r.operator }));

  if (rows.length === 0) {
    // 조용히 0건 매칭으로 끝내면 "총괄장에 아무도 없다"로 읽힌다.
    return { ok: false, error: "총괄장을 읽지 못했습니다" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcement_services")
    .select("university_name");
  if (error) return { ok: false, error: error.message };

  const universities = [
    ...new Set((data ?? []).map((r) => r.university_name as string)),
  ];
  const { matched, unmatched } = matchOperators(universities, rows);

  const now = new Date().toISOString();
  let updated = 0;
  for (const m of matched) {
    const { error: upErr, count } = await admin
      .from("announcement_services")
      .update(
        { operator_name: m.operator, operator_synced_at: now },
        { count: "exact" },
      )
      .eq("university_name", m.university);
    if (!upErr) updated += count ?? 0;
  }

  return { ok: true, matched: matched.length, updated, unmatched };
}
