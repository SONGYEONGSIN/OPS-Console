import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";
import { briefingUrl } from "./url";
import { celebrationKey } from "@/features/automations/jobs/team-briefing-build";

// 기념일 중복 검사 대상 발행분 수 — 기념일 키에 연도가 들어가 1년치면 충분하다.
const CELEBRATION_LOOKBACK_ISSUES = 60;
// 사진 중복 검사 대상 발행분 수 — 수집 창이 7일이라 직전 몇 호면 충분하지만,
// 폴더를 나중에 되살려 다시 싣는 경우까지 막으려면 넉넉히 본다.
const IMAGE_LOOKBACK_ISSUES = 60;

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

/**
 * 이미 발행된 호에 실린 기념일 키 집합 — 다음 호에서 같은 기념일 재등장을 막는다.
 * 기념일 윈도우가 [-14, +14]로 넓어 주간 발행 시 최대 4호에 걸쳐 겹치던 문제 대응.
 */
export async function getPublishedCelebrationKeys(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_briefings")
    .select("payload")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(CELEBRATION_LOOKBACK_ISSUES);
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const p = row.payload as {
      milestones?: { name: string; dateYmd: string }[];
      birthdays?: { name: string; dateYmd: string }[];
    } | null;
    for (const m of p?.milestones ?? [])
      keys.add(celebrationKey("ms", m.name, m.dateYmd));
    for (const b of p?.birthdays ?? [])
      keys.add(celebrationKey("bd", b.name, b.dateYmd));
  }
  return keys;
}

/**
 * 이미 발행된 호에 실린 사진·영상의 공개 URL 집합 — 다음 호 재등장을 막는다.
 * 수집 창(최근 7일)이 주간 발행 주기와 겹쳐 한 폴더가 두 호에 걸쳐 잡히던 문제 대응.
 * 커버·갤러리·영상을 모두 모은다 (커버였던 사진이 갤러리로 다시 오는 것도 막는다).
 */
export async function getPublishedImageSrcs(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_briefings")
    .select("payload")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(IMAGE_LOOKBACK_ISSUES);
  const srcs = new Set<string>();
  for (const row of data ?? []) {
    const images = (row.payload as BriefingPayload | null)?.images;
    if (!images) continue;
    for (const m of [
      ...(images.cover ? [images.cover] : []),
      ...(images.gallery ?? []),
      ...(images.videos ?? []),
    ])
      srcs.add(m.src);
  }
  return srcs;
}
