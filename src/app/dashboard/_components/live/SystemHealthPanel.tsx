"use client";

import { useEffect, useState } from "react";
import { SideBox } from "./SideBox";
import { HealthLed } from "./HealthLed";
import type { SystemHealthSnapshot } from "@/features/system-health/queries";

/**
 * 시스템 게이트웨이 상태 — 6 항목.
 *
 * 정적 3 항목 (1차 — placeholder):
 *   - YouTube API Quota / Supabase Connection / Cron 자동화 엔진
 *
 * 실측 3 항목 (이 컴포넌트가 mount 시 /api/system-health 1회 fetch):
 *   - Microsoft Graph API token 발급
 *   - SharePoint 드라이브 접근
 *   - 24h 메일 발송 성공률 (receivables/feedback/backup 합산)
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

  const mailLabel = snap
    ? snap.mail.successRate === null
      ? "발송 없음"
      : `${(snap.mail.successRate * 100).toFixed(1)}% (${snap.mail.sent24h}/${snap.mail.sent24h + snap.mail.failed24h})`
    : "측정 중…";
  const graphLabel = snap
    ? snap.graph.ok
      ? snap.graph.detail
      : "오류"
    : "측정 중…";
  const sharePointLabel = snap
    ? snap.sharepoint.ok
      ? snap.sharepoint.detail
      : "오류"
    : "측정 중…";

  return (
    <SideBox
      title="시스템 게이트웨이 상태"
      titleRight={<HealthLed variant="vermilion" />}
    >
      <ul className="flex flex-1 flex-col justify-around gap-3">
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            YouTube API Quota
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            67.2% 잔여
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            Supabase Connection
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            12ms (Good)
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="vermilion" />
            Cron 자동화 엔진
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            정상 가동
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={snap?.graph.ok === false ? "amber" : "vermilion"} />
            Microsoft Graph API
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {graphLabel}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed
              variant={snap?.sharepoint.ok === false ? "amber" : "vermilion"}
            />
            SharePoint 드라이브
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {sharePointLabel}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed
              variant={
                snap && snap.mail.failed24h > snap.mail.sent24h * 0.1
                  ? "amber"
                  : "vermilion"
              }
            />
            메일 발송률 (24h)
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {error ? "오류" : mailLabel}
          </span>
        </li>
      </ul>
    </SideBox>
  );
}
