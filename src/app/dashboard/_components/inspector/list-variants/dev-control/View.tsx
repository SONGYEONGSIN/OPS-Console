"use client";

import { useState, useTransition } from "react";
import { updateDevControlFlag } from "@/features/dev-controls/actions";
import type {
  DevControlAnalysis,
  DevControlFlag,
} from "@/features/dev-controls/schemas";
import type { ViewProps } from "../types";

/** 원서제어 flag 1건 — 체크박스(단정 여부) + 메모 input. 변경 시 action 호출. */
function FlagRow({
  analysisId,
  flag,
}: {
  analysisId: string;
  flag: DevControlFlag;
}) {
  const [checked, setChecked] = useState(flag.checked);
  const [note, setNote] = useState(flag.note);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const commit = (nextChecked: boolean, nextNote: string) => {
    setError(null);
    startTransition(async () => {
      const r = await updateDevControlFlag({
        analysisId,
        flagKey: flag.key,
        checked: nextChecked,
        note: nextNote,
      });
      if (!r.ok) setError(r.error ?? "저장 실패");
    });
  };

  return (
    <li className="flex items-start gap-2 py-2">
      <input
        type="checkbox"
        aria-label={flag.label}
        checked={checked}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          commit(next, note);
        }}
        className="mt-0.5 size-3.5 accent-vermilion"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={`text-xs font-medium ${checked ? "text-muted line-through" : "text-ink"}`}
        >
          {flag.label}
        </p>
        {flag.snippet && <p className="text-2xs text-muted">{flag.snippet}</p>}
        <input
          type="text"
          aria-label={`${flag.label} 메모`}
          value={note}
          placeholder="메모"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => commit(checked, note)}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
        {error && <p className="text-2xs text-vermilion">{error}</p>}
      </div>
    </li>
  );
}

/** kind 배지 — A=운영자 제어(잉크) / AU=개발자 제어(버밀리언). */
function KindBadge({ kind }: { kind: DevControlAnalysis["kind"] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-2xs ${
        kind === "A" ? "bg-ink text-cream" : "bg-vermilion text-cream"
      }`}
    >
      {kind === "A" ? "운영자 제어" : "개발자 제어"}
    </span>
  );
}

function DevControlSection({ analysis }: { analysis: DevControlAnalysis }) {
  return (
    <section className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-ink">{analysis.file_name}</h3>
        <KindBadge kind={analysis.kind} />
      </div>
      {analysis.summary_md && (
        <p className="whitespace-pre-wrap text-xs text-ink-soft">
          {analysis.summary_md}
        </p>
      )}
      {analysis.flags.length > 0 && (
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {analysis.flags.map((flag) => (
            <FlagRow key={flag.key} analysisId={analysis.id} flag={flag} />
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-muted">
          원본 코드
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto bg-cream p-2 text-2xs text-ink-soft">
          {analysis.raw_code}
        </pre>
      </details>
    </section>
  );
}

/** analyses 정렬 — kind(A→AU) 우선, 동일 kind는 file_name 순. */
function sortAnalyses(analyses: DevControlAnalysis[]): DevControlAnalysis[] {
  return [...analyses].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "A" ? -1 : 1;
    return a.file_name.localeCompare(b.file_name);
  });
}

/**
 * dev-control variant 인스펙터 View — 서비스별 원서제어 분석(A/AU) 섹션 렌더.
 * 요약(summary_md) + 플래그 체크/메모 + 원본 코드(details 접힘).
 */
export function DevControlView({ row }: ViewProps) {
  const analyses = row.devControlAnalyses ?? [];

  if (analyses.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          {row.universityName} · {row.serviceName ?? row.name}
        </h2>
        <p className="text-xs text-muted">수집된 원서제어 없음</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-ink">
        {row.universityName} · {row.serviceName ?? row.name}
      </h2>
      {sortAnalyses(analyses).map((analysis) => (
        <DevControlSection key={analysis.id} analysis={analysis} />
      ))}
    </div>
  );
}
