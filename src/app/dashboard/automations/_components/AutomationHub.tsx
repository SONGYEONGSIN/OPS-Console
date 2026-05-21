"use client";

import { useActionState, useState } from "react";
import {
  runAutomationAction,
  type RunActionState,
} from "@/features/automations/actions";
import type { AutomationStatus } from "@/features/automations/types";

export function AutomationHub({ statuses }: { statuses: AutomationStatus[] }) {
  return (
    <div className="flex flex-col gap-4">
      {statuses.map((s) => (
        <AutomationRow key={s.id} status={s} />
      ))}
    </div>
  );
}

function AutomationRow({ status }: { status: AutomationStatus }) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    runAutomationAction,
    undefined,
  );
  // '강제 실행'을 누른 시점의 action state를 기억한다. 액션이 끝나면 useActionState가
  // 새 state 객체를 돌려주므로 armedAgainst.state !== state 가 되어 확인 단계가 자동 해제된다.
  const [armedAgainst, setArmedAgainst] = useState<{ state: RunActionState } | null>(null);
  const confirming = armedAgainst !== null && armedAgainst.state === state;
  const inCooldown = status.cooldownRemainingMinutes > 0;

  return (
    <div className="rounded-lg border border-faint bg-cream p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-ink">{status.label}</h3>
          <p className="text-sm leading-[1.6] text-muted">{status.description}</p>
          <p className="mt-1 text-xs tracking-[0.02em] text-muted">
            {status.scheduleInfo}
            {status.lastRunAt
              ? ` · 마지막 실행 ${new Date(status.lastRunAt).toLocaleString("ko-KR")}`
              : " · 실행 기록 없음"}
          </p>
        </div>

        <form action={formAction} className="shrink-0">
          <input type="hidden" name="jobId" value={status.id} />
          {!inCooldown ? (
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {pending ? "실행 중…" : "지금 실행"}
            </button>
          ) : !confirming ? (
            <button
              type="button"
              onClick={() => setArmedAgainst({ state })}
              className="rounded-md border border-vermilion px-4 py-2 text-sm font-medium text-vermilion"
            >
              쿨다운 {status.cooldownRemainingMinutes}분 — 강제 실행
            </button>
          ) : (
            <button
              type="submit"
              name="force"
              value="1"
              disabled={pending}
              className="rounded-md bg-vermilion px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {pending ? "실행 중…" : "quota 소모 — 확인"}
            </button>
          )}
        </form>
      </div>

      {state ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-ink" : "text-vermilion"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
