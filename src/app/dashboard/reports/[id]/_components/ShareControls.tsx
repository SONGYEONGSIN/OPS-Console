"use client";

import { useState, useTransition } from "react";
import { toggleReportShare } from "@/features/reports/actions";

type Props = {
  reportId: string;
  initialToken: string | null;
};

export function ShareControls({ reportId, initialToken }: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleReportShare(reportId);
      if (r.ok) setToken(r.token ?? null);
    });
  }

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/r/${token}`
      : null;

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!token) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:border-vermilion hover:text-vermilion disabled:opacity-50"
      >
        {pending ? "처리 중…" : "공유 링크 생성"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-line bg-washi px-3 py-1.5 text-sm">
      <span className="text-xs text-muted">공유:</span>
      <code className="break-all text-xs text-ink">/r/{token}</code>
      <button
        type="button"
        onClick={handleCopy}
        className="border border-line bg-cream px-2 py-0.5 text-xs text-ink hover:border-vermilion"
      >
        {copied ? "복사됨" : "복사"}
      </button>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="text-xs text-muted hover:text-vermilion"
      >
        해제
      </button>
    </div>
  );
}
