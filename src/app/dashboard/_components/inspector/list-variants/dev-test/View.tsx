"use client";

import { useActionState, useState } from "react";
import {
  requestEntertestRun,
  setMyEntertestAccount,
  type EntertestActionState,
} from "@/features/entertest/actions";
import type { EntertestRunStatus } from "@/features/entertest/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";
import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";

const STATUS_LABEL: Record<EntertestRunStatus, string> = {
  pending: "대기",
  running: "실행 중",
  done: "완료",
  failed: "실패",
  error: "오류",
};

/** ISO → KST 'YYYY-MM-DD'. 값 없으면 '-'. */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

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
 * dev-test variant 인스펙터 View — 표준 Section/DefList 구성.
 * 서비스 기본 / 테스트 대역 계정 / 테스트 실행 / 실행 이력.
 */
export function DevTestView({ row }: ViewProps) {
  const [acctState, acctAction, acctPending] = useActionState<
    EntertestActionState,
    FormData
  >(setMyEntertestAccount, undefined);
  const [runState, runAction, runPending] = useActionState<
    EntertestActionState,
    FormData
  >(requestEntertestRun, undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  const serviceId = row.serviceIdNum ?? 0;
  const runs = row.entertestRuns ?? [];
  const account = row.entertestAccount ?? null;
  const accountReady = !!account;
  const [acctStart = "", acctEnd = ""] = (account ?? "").split("~");
  const testUrl = `https://entertest.jinhakapply.com/Notice/${serviceId}/A`;

  return (
    <div className="space-y-6">
      <Section title="서비스 기본">
        <DefList
          items={[
            {
              term: "service_id",
              desc: serviceId,
            },
            { term: "대학명", desc: row.universityName ?? "-" },
            { term: "서비스명", desc: row.serviceName ?? "-" },
            {
              term: "카테고리",
              desc: row.category ? (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.category}
                </span>
              ) : (
                "-"
              ),
            },
            {
              term: "작성기간",
              desc: `${fmtDate(row.writeStartAt)} ~ ${fmtDate(row.writeEndAt)}`,
            },
            {
              term: "결제기간",
              desc: `${fmtDate(row.payStartAt)} ~ ${fmtDate(row.payEndAt)}`,
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="테스트 대역 계정">
        <DefList
          items={[
            {
              term: "등록 계정",
              desc: account ? (
                <span>
                  <span className="font-semibold">{account}</span>
                  <span className="ml-1 text-xs text-muted">(ID=PW 동일)</span>
                </span>
              ) : (
                <span className="font-bold text-vermilion">미등록</span>
              ),
            },
          ]}
        />
        <form action={acctAction} className="flex items-center gap-2">
          <input
            name="account_start"
            defaultValue={acctStart}
            placeholder="jt29001"
            className="min-w-0 flex-1 border border-line bg-cream px-2 py-1.5 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <span className="shrink-0 text-sm text-muted">~</span>
          <input
            name="account_end"
            defaultValue={acctEnd}
            placeholder="jt29005 (선택)"
            className="min-w-0 flex-1 border border-line bg-cream px-2 py-1.5 text-sm text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={acctPending}
            className="shrink-0 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {account ? "수정" : "등록"}
          </button>
        </form>
        {acctState && (
          <p
            className={`text-xs ${acctState.ok ? "text-ink-soft" : "text-vermilion"}`}
          >
            {acctState.message}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted">
          담당자 배정 테스트 대역을 등록하세요.
        </p>
      </Section>

      <Divider />

      <Section title="테스트 실행">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-xs text-muted">URL</span>
          <input
            readOnly
            value={testUrl}
            className="w-full select-all border border-line bg-cream px-2 py-1.5 text-sm text-ink-soft"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <span className="text-xs text-muted">실행</span>
          <form action={runAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="serviceId" value={serviceId} />
            <button
              type="submit"
              disabled={runPending || !accountReady}
              className="cursor-pointer border border-ink bg-ink px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runPending ? "요청 중..." : "테스트 실행"}
            </button>
            {!accountReady && (
              <span className="text-xs text-vermilion">
                대역 계정을 먼저 등록하세요.
              </span>
            )}
          </form>
        </div>
        {runState && (
          <p
            className={`text-xs ${runState.ok ? "text-ink-soft" : "text-vermilion"}`}
          >
            {runState.message}
          </p>
        )}
      </Section>

      <Divider />

      <Section title={`실행 이력 (${runs.length}건)`}>
        {runs.length === 0 ? (
          <p className="text-xs text-muted">이 서비스의 실행 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line-soft border-y border-line-soft">
            {runs.map((run) => {
              const open = expanded === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full cursor-pointer items-center gap-3 py-2 text-left text-xs hover:bg-line-soft"
                  >
                    <StatusBadge status={run.status} />
                    <span className="text-muted">
                      {run.requested_at.slice(0, 16).replace("T", " ")}
                    </span>
                    <span className="text-ink-soft">
                      {operatorNameByEmail(run.requested_by)}
                    </span>
                    {run.result && (
                      <span className="ml-auto text-ink">
                        {run.result.summary.pass}/{run.result.summary.total} 통과
                      </span>
                    )}
                  </button>
                  {open && run.result && (
                    <ul className="bg-cream px-2 py-2">
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
                    <p className="bg-cream px-2 py-2 text-2xs text-vermilion">
                      {run.error_message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
