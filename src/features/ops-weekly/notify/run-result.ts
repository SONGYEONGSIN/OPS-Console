import type { AutomationRunResult } from "@/features/automations/types";
import type { SendOutcome } from "./run";

/** 발송 결과 → 자동화 실행 기록. 0 인 칸은 적지 않는다 — 한 줄로 읽히게. */
export function toRunResult(label: string, out: SendOutcome): AutomationRunResult {
  if (out.kind === "skipped") {
    return { ok: true, skipped: true, message: `${label} — ${out.reason}` };
  }
  if (out.kind === "failed") return { ok: false, message: `${label} — ${out.reason}` };
  const t = out.tally;
  const parts = [
    t.sent > 0 ? `보냄 ${t.sent}` : null,
    t.dryRun > 0 ? `시험 실행 ${t.dryRun}` : null,
    t.skipped > 0 ? `이미 보냄 ${t.skipped}` : null,
    t.failed > 0 ? `실패 ${t.failed} (${t.errors[0] ?? "알 수 없음"})` : null,
    out.teams === "unset" ? "Teams 채팅 id 미설정(메일만)" : null,
  ].filter((x): x is string => x !== null);
  return {
    ok: t.failed === 0,
    message: `${label} — ${parts.join(" · ") || "보낼 사람 없음"}`,
    details: { sent: t.sent, failed: t.failed, dryRun: t.dryRun, skipped: t.skipped },
  };
}
