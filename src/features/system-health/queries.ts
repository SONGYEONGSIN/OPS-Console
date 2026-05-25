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
  const [graph, sharepoint, sso, mail] = await Promise.all([
    probeGraph(),
    probeSharePointDrive(),
    probeMicrosoftSSO(),
    probeMailStats(),
  ]);
  return { graph, sharepoint, sso, mail };
}
