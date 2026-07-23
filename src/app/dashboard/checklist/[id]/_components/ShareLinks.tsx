"use client";

import { useState, useTransition } from "react";
import type { ShareToken } from "@/features/checklist/schemas";
import { toggleChecklistShare } from "@/features/checklist/actions";

const STD =
  "cursor-pointer border border-ink bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50";
const STD_SM =
  "cursor-pointer border border-line bg-white px-2 py-0.5 text-xs text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50";

/**
 * 공유 링크 토글 1종 — reports ShareControls 패턴(생성/해제). 표준 버튼 스타일.
 * 없으면 '{label} 생성', 있으면 복사/해제. URL = {origin}/r/checklist/{token}.
 */
function ShareControl({
  roundId,
  kind,
  label,
  initialToken,
}: {
  roundId: string;
  kind: "fill" | "report";
  label: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const toggle = () =>
    startTransition(async () => {
      const r = await toggleChecklistShare(roundId, kind);
      if (r.ok) setToken(r.token ?? null);
    });
  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${origin}/r/checklist/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (!token) {
    return (
      <button type="button" onClick={toggle} disabled={pending} className={STD}>
        {pending ? "처리 중…" : `${label} 생성`}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 border border-line-soft bg-search-field-bg px-2 py-1">
      <span className="text-xs text-muted">{label}</span>
      <button type="button" onClick={copy} className={STD_SM}>
        {copied ? "복사됨" : "복사"}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={STD_SM}
      >
        해제
      </button>
    </div>
  );
}

/** 작성 공유 링크(fill) + 확인 공유 링크(report) — 회차 상세 액션 행. */
export function ShareLinks({
  roundId,
  tokens,
}: {
  roundId: string;
  tokens: ShareToken[];
}) {
  const fill = tokens.find((t) => t.kind === "fill");
  const report = tokens.find((t) => t.kind === "report");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShareControl
        roundId={roundId}
        kind="fill"
        label="작성 공유 링크"
        initialToken={fill?.token ?? null}
      />
      <ShareControl
        roundId={roundId}
        kind="report"
        label="보고용 링크"
        initialToken={report?.token ?? null}
      />
    </div>
  );
}
