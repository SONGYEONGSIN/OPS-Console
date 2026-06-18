"use client";

import { useActionState, useState } from "react";
import {
  requestEntertestRun,
  setMyEntertestAccount,
  type EntertestActionState,
} from "@/features/entertest/actions";
import type { EntertestRun, EntertestRunStatus } from "@/features/entertest/schemas";

const DEFAULT_URL = "https://entertest.jinhakapply.com/Notice/1098146/A";

const STATUS_LABEL: Record<EntertestRunStatus, string> = {
  pending: "대기",
  running: "실행 중",
  done: "완료",
  failed: "실패",
  error: "오류",
};

function StatusBadge({ status }: { status: EntertestRunStatus }) {
  const tone =
    status === "done"
      ? "text-ink bg-line-soft"
      : status === "failed" || status === "error"
        ? "text-paper bg-vermilion"
        : "text-ink-soft bg-cream";
  return (
    <span className={`inline-flex px-2 py-0.5 text-2xs ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DevTestClient({
  runs,
  myAccount,
}: {
  runs: EntertestRun[];
  myAccount: string | null;
}) {
  const [runState, runAction, runPending] = useActionState<
    EntertestActionState,
    FormData
  >(requestEntertestRun, undefined);
  const [acctState, acctAction, acctPending] = useActionState<
    EntertestActionState,
    FormData
  >(setMyEntertestAccount, undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 본인 테스트 계정 */}
      <section className="border border-line bg-paper p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">테스트 계정</h2>
        {myAccount ? (
          <p className="text-xs text-ink-soft">
            등록된 계정: <span className="font-semibold text-ink">{myAccount}</span>{" "}
            (ID=PW 동일)
          </p>
        ) : (
          <p className="mb-2 text-xs font-bold text-vermilion">
            테스트 계정이 등록되지 않았습니다. 본인 계정을 등록하세요.
          </p>
        )}
        <form action={acctAction} className="mt-2 flex items-center gap-2">
          <input
            name="account"
            defaultValue={myAccount ?? ""}
            placeholder="jt29001"
            className="border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={acctPending}
            className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
          >
            {myAccount ? "수정" : "등록"}
          </button>
          {acctState && (
            <span
              className={`text-2xs ${acctState.ok ? "text-ink-soft" : "text-vermilion"}`}
            >
              {acctState.message}
            </span>
          )}
        </form>
      </section>

      {/* 실행 요청 */}
      <section className="border border-line bg-paper p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">테스트 실행</h2>
        <form action={runAction} className="flex items-center gap-2">
          <input
            name="targetUrl"
            defaultValue={DEFAULT_URL}
            className="flex-1 border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={runPending || !myAccount}
            className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
          >
            테스트 실행
          </button>
        </form>
        {runState && (
          <p
            className={`mt-2 text-2xs ${runState.ok ? "text-ink-soft" : "text-vermilion"}`}
          >
            {runState.message}
          </p>
        )}
      </section>

      {/* 실행 이력 */}
      <section className="border border-line bg-paper">
        <h2 className="border-b border-line-soft px-3 py-2 text-sm font-semibold text-ink">
          실행 이력
        </h2>
        {runs.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">
            실행 이력이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {runs.map((run) => {
              const open = expanded === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-xs hover:bg-washi-raised"
                  >
                    <StatusBadge status={run.status} />
                    <span className="text-muted">{run.requested_at.slice(0, 16).replace("T", " ")}</span>
                    <span className="text-ink-soft">{run.requested_by}</span>
                    {run.result && (
                      <span className="ml-auto text-ink">
                        {run.result.summary.pass}/{run.result.summary.total} 통과
                      </span>
                    )}
                  </button>
                  {open && run.result && (
                    <ul className="bg-cream px-3 py-2">
                      {run.result.checks.map((c) => (
                        <li key={c.key} className="flex items-center gap-2 py-1 text-2xs">
                          <span
                            className={
                              c.status === "pass"
                                ? "text-ink"
                                : c.status === "fail"
                                  ? "font-bold text-vermilion"
                                  : "text-muted"
                            }
                          >
                            {c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–"}
                          </span>
                          <span className="text-ink-soft">{c.label}</span>
                          {c.message && <span className="text-muted">{c.message}</span>}
                          {c.screenshot_url && (
                            <a
                              href={c.screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-vermilion underline"
                            >
                              스크린샷
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {open && !run.result && run.error_message && (
                    <p className="bg-cream px-3 py-2 text-2xs text-vermilion">
                      {run.error_message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
