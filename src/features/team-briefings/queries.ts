import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";
import { briefingUrl } from "./url";

export type TeamBriefing = {
  issueNo: number;
  briefingDate: string;
  payload: BriefingPayload;
  status: "draft" | "published";
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
    .select("issue_no, briefing_date, payload, status")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    issueNo: data.issue_no as number,
    briefingDate: data.briefing_date as string,
    payload: data.payload as BriefingPayload,
    status: data.status === "draft" ? "draft" : "published",
  };
}

export type PendingBriefingDraft = {
  id: string;
  issueNo: number;
  url: string;
  createdAt: string;
};

/** 발행 대기 중인 초안 1건 — 없으면 null. 자동화 페이지 [미리보기]/[발행]에 쓴다. */
export async function getPendingBriefingDraft(): Promise<PendingBriefingDraft | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_briefings")
    .select("id, issue_no, share_token, created_at")
    .eq("status", "draft")
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    issueNo: data.issue_no as number,
    url: briefingUrl(data.share_token as string),
    createdAt: data.created_at as string,
  };
}
