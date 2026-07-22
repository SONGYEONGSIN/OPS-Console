"use client";

import { useState } from "react";
import {
  DEPARTMENTS,
  type Department,
  type ShareToken,
} from "@/features/checklist/schemas";
import {
  issueTokenAction,
  toggleTokenAction,
} from "@/features/checklist/actions";

type Props = {
  roundId: string;
  tokens: ShareToken[];
};

/**
 * 회차 상세 — 부서별 fill 링크 + 임원 보고 링크 발급/복사/토글.
 * URL 규격: {origin}/r/checklist/{token} (공개 라우트는 Plan 2에서 구현).
 */
export function ShareLinks({ roundId, tokens }: Props) {
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const report = tokens.find((t) => t.kind === "report");
  const deptToken = (d: Department) =>
    tokens.find((t) => t.kind === "dept-fill" && t.department === d);
  const copy = (tok: string) =>
    navigator.clipboard.writeText(`${origin}/r/checklist/${tok}`);
  const issue = async (
    kind: "dept-fill" | "report",
    dept: Department | null,
  ) => {
    setBusy(true);
    await issueTokenAction(roundId, kind, dept);
    setBusy(false);
  };

  return (
    <section className="border border-line-soft bg-situation-bg p-4">
      <h3 className="text-sm font-bold text-ink">공유 링크</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEPARTMENTS.map((d) => {
          const t = deptToken(d);
          return (
            <div
              key={d}
              className="flex items-center gap-1 border border-line px-2 py-1 text-xs"
            >
              <span className="font-medium">{d}</span>
              {t ? (
                <>
                  <button
                    type="button"
                    onClick={() => copy(t.token)}
                    className="text-vermilion"
                  >
                    링크 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTokenAction(t.id, roundId, !t.enabled)}
                    className="text-muted"
                  >
                    {t.enabled ? "비활성" : "활성"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => issue("dept-fill", d)}
                  className="text-vermilion"
                >
                  발급
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs">
        임원 보고 링크:{" "}
        {report ? (
          <button
            type="button"
            onClick={() => copy(report.token)}
            className="text-vermilion"
          >
            복사
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => issue("report", null)}
            className="text-vermilion"
          >
            발급
          </button>
        )}
      </div>
    </section>
  );
}
