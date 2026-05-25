"use client";

import { useEffect, useState } from "react";
import { SideBox } from "./SideBox";
import { HealthLed } from "./HealthLed";
import type { SystemHealthSnapshot } from "@/features/system-health/queries";

/**
 * 시스템 게이트웨이 상태 — 7 항목 모두 실측.
 * mount 시 /api/system-health 1회 fetch (no-store).
 *
 * 측정 대상:
 *  - YouTube API Quota — insight_videos 24h 수집 여부 + 700 units/day 추정
 *  - Supabase Connection — operators select ping ms
 *  - Cron 자동화 엔진 — insight_videos.collected_at 최신 (24h 초과 amber)
 *  - Microsoft Graph API — getGraphToken() 성공 여부
 *  - SharePoint 드라이브 — /drives/{id} 접근
 *  - Microsoft SSO — Supabase Auth /auth/v1/settings external.azure
 *  - 메일 발송률 (24h) — 3 mail_sends 테이블 sent/failed
 */
export function SystemHealthPanel() {
  const [snap, setSnap] = useState<SystemHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/system-health", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SystemHealthSnapshot;
      })
      .then((s) => {
        if (!cancelled) setSnap(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function probeLabel(probe: { ok: boolean; detail: string } | undefined): string {
    if (error) return "오류";
    if (!probe) return "측정 중…";
    return probe.detail;
  }

  function probeVariant(
    probe: { ok: boolean } | undefined,
  ): "vermilion" | "amber" {
    return probe?.ok === false ? "amber" : "vermilion";
  }

  const mailLabel = error
    ? "오류"
    : snap
      ? snap.mail.successRate === null
        ? "발송 없음"
        : `${(snap.mail.successRate * 100).toFixed(1)}% (${snap.mail.sent24h}/${snap.mail.sent24h + snap.mail.failed24h})`
      : "측정 중…";
  const mailVariant: "vermilion" | "amber" =
    snap && snap.mail.failed24h > snap.mail.sent24h * 0.1
      ? "amber"
      : "vermilion";

  return (
    <SideBox
      title="시스템 게이트웨이 상태"
      titleRight={<HealthLed variant="vermilion" />}
    >
      <ul className="flex flex-1 flex-col justify-around gap-3">
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.youtube)} />
            YouTube API Quota
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.youtube)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.supabase)} />
            Supabase Connection
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.supabase)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.cron)} />
            Cron 자동화 엔진
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.cron)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.graph)} />
            Microsoft Graph API
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.graph)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.sharepoint)} />
            SharePoint 드라이브
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.sharepoint)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={probeVariant(snap?.sso)} />
            Microsoft SSO
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {probeLabel(snap?.sso)}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={mailVariant} />
            메일 발송률 (24h)
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {mailLabel}
          </span>
        </li>
      </ul>
    </SideBox>
  );
}
