import "server-only";

import { getGraphToken } from "@/lib/microsoft/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProbeResult = {
  ok: boolean;
  /** 사용자에게 표시할 한 줄 상세 */
  detail: string;
};

export type MailStats = {
  /** 최근 24h 발송 성공 건수 (3 메일 테이블 합산) */
  sent24h: number;
  /** 최근 24h 발송 실패 건수 */
  failed24h: number;
  /** 성공률 (분모 0이면 null) */
  successRate: number | null;
};

export type SystemHealthSnapshot = {
  graph: ProbeResult;
  sharepoint: ProbeResult;
  sso: ProbeResult;
  supabase: ProbeResult;
  cron: ProbeResult;
  youtube: ProbeResult;
  mail: MailStats;
};

async function probeGraph(): Promise<ProbeResult> {
  try {
    const token = await getGraphToken();
    if (!token) return { ok: false, detail: "토큰 빈 응답" };
    return { ok: true, detail: "토큰 정상" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

async function probeSharePointDrive(): Promise<ProbeResult> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) return { ok: false, detail: "DRIVE_ID 환경변수 없음" };
  let token: string;
  try {
    token = await getGraphToken();
  } catch {
    return { ok: false, detail: "토큰 발급 실패" };
  }
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) return { ok: true, detail: "드라이브 접근 정상" };
    return { ok: false, detail: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

/**
 * Supabase Auth의 Microsoft(Azure AD) OAuth provider 활성 여부.
 * `/auth/v1/settings` public endpoint의 `external.azure` 플래그 확인.
 * 비활성 시 사용자의 'Microsoft SSO로 계속' 버튼이 작동 안 함.
 */
async function probeMicrosoftSSO(): Promise<ProbeResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) return { ok: false, detail: "SUPABASE_URL 없음" };
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: anonKey ? { apikey: anonKey } : {},
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const json = (await res.json()) as { external?: { azure?: boolean } };
    if (json?.external?.azure === true) {
      return { ok: true, detail: "Azure OAuth 활성" };
    }
    return { ok: false, detail: "Azure provider 비활성" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

/**
 * Supabase 연결 핑 — operators 테이블 select 1 + 응답시간 측정.
 * 캐시 X (매번 신선한 ms 측정).
 */
async function probeSupabasePing(): Promise<ProbeResult> {
  const admin = createAdminClient();
  const start = Date.now();
  try {
    const { error } = await admin.from("operators").select("id").limit(1);
    const ms = Date.now() - start;
    if (error) return { ok: false, detail: error.message.slice(0, 80) };
    return { ok: true, detail: `${ms}ms` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

/**
 * Cron 자동화 엔진 — insight_videos.collected_at 최신값 기준 마지막 실행 추정.
 * insights-fetch.yml 이 매일 한국 08:00 실행 → 24h 이내 수집 있으면 정상.
 * 36h 초과 시 amber (지연 또는 cron 미실행).
 */
async function probeCron(): Promise<ProbeResult> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("insight_videos")
      .select("collected_at")
      .order("collected_at", { ascending: false })
      .limit(1);
    if (error) return { ok: false, detail: error.message.slice(0, 80) };
    const last = data?.[0]?.collected_at as string | undefined;
    if (!last) return { ok: false, detail: "수집 이력 없음" };
    const hoursAgo = Math.round(
      (Date.now() - new Date(last).getTime()) / (60 * 60 * 1000),
    );
    if (hoursAgo > 36) {
      return { ok: false, detail: `${hoursAgo}시간 전 (지연)` };
    }
    return { ok: true, detail: `${hoursAgo}시간 전` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

/**
 * YouTube API quota — 정확한 측정 불가(Google Cloud Console만 노출).
 * insights-fetch는 search.list 1회=100 units × 7 키워드 = 700 units/day 사용 추정.
 * 일 한도 10,000 → 약 7% 사용.
 * 24h 내 insight_videos 수집 건수로 cron 실 실행 여부 검증.
 */
async function probeYoutubeQuota(): Promise<ProbeResult> {
  const admin = createAdminClient();
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await admin
      .from("insight_videos")
      .select("*", { count: "exact", head: true })
      .gte("collected_at", since);
    if (error) return { ok: false, detail: error.message.slice(0, 80) };
    const collected = count ?? 0;
    if (collected === 0) {
      return { ok: false, detail: "24h 호출 없음" };
    }
    // 700 units/day 추정. 일 한도 10,000 → 7% 사용.
    return { ok: true, detail: "~700 units/day (추정)" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 80) };
  }
}

const MAIL_TABLES = [
  "receivables_mail_sends",
  "feedback_mail_sends",
  "backup_request_mail_sends",
] as const;

async function probeMailStats(): Promise<MailStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  let sent = 0;
  let failed = 0;
  for (const table of MAIL_TABLES) {
    const { count: sentCount } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte("sent_at", since)
      .eq("status", "sent");
    const { count: failedCount } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte("sent_at", since)
      .eq("status", "failed");
    sent += sentCount ?? 0;
    failed += failedCount ?? 0;
  }
  const total = sent + failed;
  const successRate = total === 0 ? null : sent / total;
  return { sent24h: sent, failed24h: failed, successRate };
}

/**
 * 운영 환경 시스템 헬스 종합 — Graph token / SharePoint drive / 24h 메일 발송 통계.
 * 호출 비용: Graph token 1회(캐시 hit 시 0) + SharePoint drives GET 1회 + mail_sends count 6회.
 * 결과는 호출자가 캐시(예: HTTP cache-control 60s).
 */
export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
  const [graph, sharepoint, sso, supabase, cron, youtube, mail] =
    await Promise.all([
      probeGraph(),
      probeSharePointDrive(),
      probeMicrosoftSSO(),
      probeSupabasePing(),
      probeCron(),
      probeYoutubeQuota(),
      probeMailStats(),
    ]);
  return { graph, sharepoint, sso, supabase, cron, youtube, mail };
}
