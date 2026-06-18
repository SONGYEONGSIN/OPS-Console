"use client";

import { useActionState, useState } from "react";
import {
  requestEntertestRun,
  type EntertestActionState,
} from "@/features/entertest/actions";
import type { TestableService } from "@/features/entertest/queries";
import type { EntertestRun, EntertestRunStatus } from "@/features/entertest/schemas";

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

/**
 * dev-test 우측 인스펙터.
 * 선택 서비스의 테스트 URL, 테스트 실행 폼, 실행 로그를 표시한다.
 */
export function DevTestInspector({
  service,
  runs,
  accountReady,
}: {
  service: TestableService | null;
  runs: EntertestRun[];
  accountReady: boolean;
}) {
  const [runState, runAction, runPending] = useActionState<
    EntertestActionState,
    FormData
  >(requestEntertestRun, undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!service) {
    return (
      <div className="flex h-full items-center justify-center border border-line bg-paper p-8">
        <p className="text-sm text-muted">왼쪽에서 서비스를 선택하세요.</p>
      </div>
    );
  }

  const serviceRuns = runs.filter((r) => r.service_id === service.service_id);
  const testUrl = `https://entertest.jinhakapply.com/Notice/${service.service_id}/A`;

  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <div className="border border-line bg-paper px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {service.university_name} — {service.service_name}
          <span className="ml-1 font-normal text-muted">({service.service_id})</span>
        </h2>
      </div>

      {/* 테스트 URL */}
      <section className="border border-line bg-paper px-4 py-3">
        <h3 className="mb-1.5 text-xs font-semibold text-ink">테스트 URL</h3>
        <input
          readOnly
          value={testUrl}
          className="w-full select-all border border-line-soft bg-cream px-2 py-1 text-xs text-ink-soft"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </section>

      {/* 테스트 실행 */}
      <section className="border border-line bg-paper px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold text-ink">테스트 실행</h3>
        <form action={runAction} className="flex items-center gap-2">
          <input type="hidden" name="serviceId" value={service.service_id} />
          <button
            type="submit"
            disabled={runPending || !accountReady}
            className="cursor-pointer border border-line bg-paper px-4 py-1.5 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runPending ? "요청 중..." : "테스트 실행"}
          </button>
          {!accountReady && (
            <span className="text-2xs text-vermilion">
              상단에서 테스트 계정을 먼저 등록하세요.
            </span>
          )}
        </form>
        {runState && (
          <p
            className={`mt-2 text-2xs ${runState.ok ? "text-ink-soft" : "text-vermilion"}`}
          >
            {runState.message}
          </p>
        )}
      </section>

      {/* 실행 로그 */}
      <section className="border border-line bg-paper">
        <h3 className="border-b border-line-soft px-4 py-2 text-xs font-semibold text-ink">
          실행 이력{" "}
          <span className="font-normal text-muted">({serviceRuns.length}건)</span>
        </h3>
        {serviceRuns.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">
            이 서비스의 실행 이력이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {serviceRuns.map((run) => {
              const open = expanded === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-xs hover:bg-washi-raised"
                  >
                    <StatusBadge status={run.status} />
                    <span className="text-muted">
                      {run.requested_at.slice(0, 16).replace("T", " ")}
                    </span>
                    <span className="text-ink-soft">{run.requested_by}</span>
                    {run.result && (
                      <span className="ml-auto text-ink">
                        {run.result.summary.pass}/{run.result.summary.total} 통과
                      </span>
                    )}
                  </button>
                  {open && run.result && (
                    <ul className="bg-cream px-4 py-2">
                      {run.result.checks.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-center gap-2 py-1 text-2xs"
                        >
                          <span
                            className={
                              c.status === "pass"
                                ? "text-ink"
                                : c.status === "fail"
                                  ? "font-bold text-vermilion"
                                  : "text-muted"
                            }
                          >
                            {c.status === "pass"
                              ? "✓"
                              : c.status === "fail"
                                ? "✗"
                                : "–"}
                          </span>
                          <span className="text-ink-soft">{c.label}</span>
                          {c.message && (
                            <span className="text-muted">{c.message}</span>
                          )}
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
                    <p className="bg-cream px-4 py-2 text-2xs text-vermilion">
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
