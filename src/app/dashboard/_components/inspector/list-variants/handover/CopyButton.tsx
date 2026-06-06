"use client";

import { useState } from "react";

/** 전화/이메일 등 짧은 텍스트 클립보드 복사 버튼. 복사 후 잠깐 '복사됨' 표시. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 권한 없음 등 — 조용히 무시
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label ?? value} 복사`}
      className="flex-none cursor-pointer border border-line-soft bg-cream px-1.5 py-0.5 text-2xs text-muted hover:border-vermilion hover:text-vermilion"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}
