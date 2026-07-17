import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";

export type TeamBriefing = {
  issueNo: number;
  briefingDate: string;
  payload: BriefingPayload;
};

/**
 * 공유 토큰으로 뉴스레터 발행분 조회 — /r/briefing/[token] (비인증 게스트 view).
 * reports getReportByShareToken 패턴: admin client 조회, 무효 토큰은 null.
 */
export async function getTeamBriefingByShareToken(
  token: string,
): Promise<TeamBriefing | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_briefings")
    .select("issue_no, briefing_date, payload")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    issueNo: data.issue_no as number,
    briefingDate: data.briefing_date as string,
    payload: data.payload as BriefingPayload,
  };
}
