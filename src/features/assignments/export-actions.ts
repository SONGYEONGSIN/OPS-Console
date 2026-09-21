"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { WORK_ASSIGNMENT_PATH } from "./paths";
import { exportAssignmentsToSheet } from "./export-write";

export type AssignmentExportState = { ok: boolean; message: string };

/**
 * 확정 원장을 총괄장의 `(앱) 배정확정` 시트로 내보낸다.
 *
 * **수동 트리거만이다**(§7.3). 자동으로 매일 쓰면 사람이 열어 둔 파일의 값이 불시에
 * 바뀐다 — 편집 중이던 내용과 충돌하고, 무엇이 언제 바뀌었는지 아무도 모른다.
 */
export async function runAssignmentExport(): Promise<AssignmentExportState> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, message: "admin만 실행할 수 있습니다" };
  }

  const r = await exportAssignmentsToSheet();
  if (!r.ok) {
    return { ok: false, message: r.error ?? "내보내기에 실패했습니다" };
  }

  revalidatePath(WORK_ASSIGNMENT_PATH);

  /**
   * **dry run 은 성공 문장이 달라야 한다.** 같으면 사람은 파일에 썼다고 믿고 시트를
   * 열어 보지도 않는다 — 첫 주를 dry run 으로 돌리는 의미가 사라진다.
   */
  if (r.dryRun) {
    return {
      ok: true,
      message: `시험 실행입니다 — ${r.rows}행 × ${r.columns}열을 조립했고 파일에는 쓰지 않았습니다`,
    };
  }
  return {
    ok: true,
    message: `배정확정 시트에 ${r.rows}행 × ${r.columns}열을 썼습니다 (반영까지 1~2분 걸립니다)`,
  };
}
