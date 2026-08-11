import type { ReportStatus } from "@/features/incident-reports/schemas";
import { BADGE_TONE } from "../badge-tone";

/** 경위서 결재 상태 → 상태 배지 Tailwind 톤 클래스 */
export const STATUS_TONE: Record<ReportStatus, string> = {
  draft: BADGE_TONE.progress,
  pending_approval: BADGE_TONE.idle,
  approved: BADGE_TONE.done,
  rejected: BADGE_TONE.attention,
  sent: BADGE_TONE.done,
};
