import type { ReportStatus } from "@/features/incident-reports/schemas";

/** 경위서 결재 상태 → 상태 배지 Tailwind 톤 클래스 */
export const STATUS_TONE: Record<ReportStatus, string> = {
  draft: "bg-washi-raised text-muted",
  pending_approval: "bg-gold/15 text-gold",
  approved: "bg-sage/15 text-sage",
  rejected: "bg-vermilion/15 text-vermilion",
  sent: "bg-ink/10 text-ink-soft",
};
