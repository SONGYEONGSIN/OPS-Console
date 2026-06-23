"use client";

import { useState } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

function formatTs(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function MailboxView({ row, onMailReply }: ViewProps) {
  const [draft, setDraft] = useState(row.mailDraftBody ?? "");
  const [busy, setBusy] = useState(false);
  const sent =
    row.mailDraftStatus === "sent" || row.mailDraftStatus === "dry_run";

  async function handleSend() {
    if (!onMailReply || !row.mailId) return;
    setBusy(true);
    const r = await onMailReply(row.id, draft);
    setBusy(false);
    if (!r.ok) alert(`발송 실패: ${r.error ?? "알 수 없는 오류"}`);
  }

  return (
    <div className="space-y-6">
      <Section title="메일">
        <DefList
          dense
          items={[
            {
              term: "보낸이",
              desc: row.mailFromName || row.mailFromEmail || "-",
            },
            { term: "주소", desc: row.mailFromEmail || "-" },
            { term: "제목", desc: row.mailSubject || "(제목 없음)" },
            { term: "수신", desc: <span>{formatTs(row.mailReceivedAt)}</span> },
          ]}
        />
      </Section>

      <Divider />

      <Section title="본문">
        <p className="whitespace-pre-wrap text-sm text-ink-soft">
          {row.mailBody || row.mailDraftBody || "(본문 없음)"}
        </p>
      </Section>

      <Divider />

      <Section title="AI 회신 초안">
        {row.mailDraftModel && (
          <span className="inline-flex items-center gap-1 bg-line-soft px-2 py-0.5 text-xs text-ink-soft">
            <span aria-hidden>✦</span> AI 생성 · {row.mailDraftModel}
          </span>
        )}
        {sent ? (
          <p className="text-sm text-muted">
            이미 발송된 메일입니다. ({row.mailDraftStatus})
          </p>
        ) : (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full border border-line bg-cream px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
              placeholder="회신 본문 (AI 초안 — 검토 후 편집)"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={busy || draft.trim().length === 0}
                onClick={handleSend}
                className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-default disabled:opacity-50"
              >
                발송
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft("")}
                className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-vermilion hover:text-cream"
              >
                폐기
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
