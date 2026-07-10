"use client";

import { useActionState, useState } from "react";
import {
  getJobRunLogAction,
  runAutomationAction,
  setAutomationEnabledAction,
  type RunActionState,
} from "@/features/automations/actions";
import type {
  AutomationStatus,
  AutomationRunEntry,
} from "@/features/automations/types";
import type { JobRunLog } from "@/features/automations/run-logs-normalize";
import { InspectorPanel } from "@/app/dashboard/_components/inspector/InspectorPanel";
import { AutomationLogPanel } from "./AutomationLogPanel";

const ADMIN_ONLY_MSG = "관리자만 실행 가능합니다.";

export function AutomationHub({
  statuses,
  isAdmin = true,
}: {
  statuses: AutomationStatus[];
  isAdmin?: boolean;
}) {
  const [selected, setSelected] = useState<{
    jobId: string;
    label: string;
  } | null>(null);
  const [log, setLog] = useState<JobRunLog | null>(null);
  const [runs, setRuns] = useState<AutomationRunEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openLog(status: AutomationStatus) {
    if (!isAdmin) {
      alert(ADMIN_ONLY_MSG);
      return;
    }
    setSelected({ jobId: status.id, label: status.label });
    setLog(null);
    setRuns([]);
    setError(null);
    setLoading(true);
    const res = await getJobRunLogAction(status.id);
    setLoading(false);
    if (res.ok) {
      setLog(res.log);
      setRuns(res.runs);
    } else setError(res.message);
  }

  return (
    <>
      {/* 인스펙터(우측 고정 오버레이) 열릴 때 본문에 우측 패딩 — 가림 방지 (ListPattern 동일) */}
      <div
        className={`transition-[padding] duration-[var(--drawer-ms)] ${
          selected !== null ? "md:pr-[340px]" : ""
        }`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-2">자동화</th>
              <th className="px-3 py-2">스케줄 · 마지막 실행</th>
              <th className="px-3 py-2">자동 실행</th>
              <th className="px-3 py-2">수동 실행</th>
            </tr>
          </thead>
          <tbody>
            {statuses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted">
                  등록된 자동화가 없습니다.
                </td>
              </tr>
            ) : (
              statuses.map((s) => (
                <AutomationRow
                  key={s.id}
                  status={s}
                  onOpenLog={openLog}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <InspectorPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <AutomationLogPanel
            label={selected.label}
            loading={loading}
            error={error}
            runs={runs}
            log={log}
          />
        )}
      </InspectorPanel>
    </>
  );
}

function AutomationRow({
  status,
  onOpenLog,
  isAdmin,
}: {
  status: AutomationStatus;
  onOpenLog: (status: AutomationStatus) => void;
  isAdmin: boolean;
}) {
  return (
    <tr className="border-b border-line align-top">
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onOpenLog(status)}
          className="group block w-full cursor-pointer text-left"
        >
          <div className="font-semibold text-ink transition-colors group-hover:text-vermilion">
            {status.label}
          </div>
          <div className="mt-0.5 whitespace-pre-line text-xs leading-[1.5] text-muted">
            {status.description}
          </div>
          <div className="mt-1 text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
            클릭하여 실행 로그 보기 →
          </div>
        </button>
      </td>
      <td className="px-3 py-3 text-xs text-muted">
        <div>{status.scheduleInfo}</div>
        <div className="mt-0.5">
          {status.lastRunAt
            ? `마지막 실행 ${new Date(status.lastRunAt).toLocaleString("ko-KR")}`
            : "실행 기록 없음"}
        </div>
      </td>
      <td className="px-3 py-3">
        {status.localOnly ? (
          <span className="text-xs text-muted">로컬 전용 (Mac mini)</span>
        ) : (
          <EnabledToggle status={status} isAdmin={isAdmin} />
        )}
      </td>
      <td className="px-3 py-3">
        {status.localOnly ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <RunControl status={status} isAdmin={isAdmin} />
        )}
      </td>
    </tr>
  );
}

function EnabledToggle({
  status,
  isAdmin,
}: {
  status: AutomationStatus;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    setAutomationEnabledAction,
    undefined,
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!isAdmin) {
          e.preventDefault();
          alert(ADMIN_ONLY_MSG);
        }
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="jobId" value={status.id} />
      <div
        role="group"
        aria-label="자동 실행 토글"
        className="flex items-center border border-line"
      >
        <button
          type="submit"
          name="enabled"
          value="1"
          aria-pressed={status.enabled}
          disabled={pending || status.enabled}
          className={`cursor-pointer px-3 py-1 text-xs transition-colors disabled:cursor-default ${
            status.enabled
              ? "bg-ink text-cream"
              : "bg-transparent text-ink hover:text-vermilion"
          }`}
        >
          ON
        </button>
        <button
          type="submit"
          name="enabled"
          value="0"
          aria-pressed={!status.enabled}
          disabled={pending || !status.enabled}
          className={`cursor-pointer border-l border-line px-3 py-1 text-xs transition-colors disabled:cursor-default ${
            !status.enabled
              ? "bg-ink text-cream"
              : "bg-transparent text-ink hover:text-vermilion"
          }`}
        >
          OFF
        </button>
      </div>
      {state && !state.ok ? (
        <span className="text-xs text-vermilion">{state.message}</span>
      ) : null}
    </form>
  );
}

function RunControl({
  status,
  isAdmin,
}: {
  status: AutomationStatus;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    runAutomationAction,
    undefined,
  );
  const [armedAgainst, setArmedAgainst] = useState<{
    state: RunActionState;
  } | null>(null);
  const confirming = armedAgainst !== null && armedAgainst.state === state;
  const inCooldown = status.cooldownRemainingMinutes > 0;

  if (status.enabled) {
    return (
      <span className="text-xs text-muted">자동 실행 중 (수동 비활성)</span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!isAdmin) {
            e.preventDefault();
            alert(ADMIN_ONLY_MSG);
          }
        }}
      >
        <input type="hidden" name="jobId" value={status.id} />
        {!inCooldown ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-fit items-center border border-vermilion bg-vermilion cursor-pointer px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "실행 중…" : "지금 실행"}
          </button>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                alert(ADMIN_ONLY_MSG);
                return;
              }
              setArmedAgainst({ state });
            }}
            className="inline-flex w-fit items-center border border-vermilion bg-transparent cursor-pointer px-3 py-1 text-xs font-medium text-vermilion transition-opacity hover:opacity-90"
          >
            쿨다운 {status.cooldownRemainingMinutes}분 — 강제 실행
          </button>
        ) : (
          <button
            type="submit"
            name="force"
            value="1"
            disabled={pending}
            className="inline-flex w-fit items-center border border-vermilion-deep bg-vermilion-deep cursor-pointer px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "실행 중…" : "quota 소모 — 확인"}
          </button>
        )}
      </form>
      {state ? (
        <span className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
