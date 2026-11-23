import {
  PROJECT_KINDS,
  type ProjectKind,
} from "@/features/ops-weekly/constants";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";

/**
 * 보고서에 보일 절 — 프로젝트는 늘, TF 는 TF 담당자에게만(맡은 TF 가 있을 때).
 * 이미 적어 둔 TF 특이사항이 있으면 담당이 빠졌어도 남긴다 — 숨기면 쓴 글이 보고서에서 조용히 사라진다.
 * 본문(ReportView)과 제출 탭 요약(SubmitTab)이 이 한 곳을 쓴다.
 */
export function shownProjectKinds(
  detail: Pick<ReportDetail, "projects" | "notes">,
): ProjectKind[] {
  return PROJECT_KINDS.filter((kind) => {
    if (kind !== "tf") return true;
    const notes = detail.notes.tf;
    return (
      detail.projects.some((e) => e.kind === "tf") ||
      notes.thisWeek !== "" ||
      notes.nextWeek !== ""
    );
  });
}
