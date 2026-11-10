"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  runRatioAuditAction,
  type RunActionState,
} from "@/features/automations/actions";
import type { AutomationStatus } from "@/features/automations/types";
import {
  RATIO_PERIOD_LABEL,
  RATIO_RECRUIT_OPTIONS,
  RATIO_UNIV_OPTIONS,
} from "@/features/ratio-audit/run-filters";
import {
  ADMIN_ONLY_MSG,
  RUN_COOLDOWN_CLASS,
  RUN_NOW_CLASS,
} from "./run-control-shared";

const CANCEL_CLASS =
  "cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50";
const SUBMIT_CLASS =
  "cursor-pointer border border-vermilion bg-vermilion px-4 py-1.5 text-sm font-medium text-cream transition-colors hover:border-ink hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50";

// 옵션 목록에서 하나를 켜거나 끈 새 배열 (불변)
function toggled(picked: readonly string[], value: string): string[] {
  return picked.includes(value)
    ? picked.filter((item) => item !== value)
    : [...picked, value];
}

// 체크박스 묶음 하나 — 공용 체크박스 컴포넌트가 없어 네이티브 input 을 쓴다
function CheckGroup({
  legend,
  name,
  options,
  picked,
  onToggle,
  help,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  picked: readonly string[];
  onToggle: (value: string) => void;
  help: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs text-muted">{legend}</legend>
      <div className="flex gap-4">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-1.5 text-sm text-ink"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={picked.includes(option)}
              onChange={() => onToggle(option)}
              className="accent-vermilion"
            />
            {option}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{help}</p>
    </fieldset>
  );
}

type DialogProps = {
  status: AutomationStatus;
  formAction: (formData: FormData) => void;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
};

// 창 본문 — 열 때마다 새로 마운트되므로 체크 상태가 빈 채로 시작한다
function RatioRunDialog({
  status,
  formAction,
  pending,
  errorMessage,
  onClose,
}: DialogProps) {
  const formId = useId();
  const [univ, setUniv] = useState<string[]>([]);
  const [recruit, setRecruit] = useState<string[]>([]);
  const cooling = status.cooldownRemainingMinutes > 0;
  const ready = univ.length > 0 && recruit.length > 0;
  // 요청 중에 닫으면 뒤늦게 온 실패가 어디에도 안 보인다 — Esc·바깥 클릭·×·취소 모두 막는다
  const close = () => {
    if (!pending) onClose();
  };

  return (
    <ModalShell
      title={`${status.label} — 실행 조건`}
      onClose={close}
      footer={
        <>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className={CANCEL_CLASS}
          >
            취소
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!ready || pending}
            className={SUBMIT_CLASS}
          >
            {pending ? "요청 중…" : cooling ? "강제 실행" : "실행"}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          // form action 으로 보내면 React 가 제출 뒤 폼을 리셋해 실패 때 고른 값이 사라진다
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="jobId" value={status.id} />
        {cooling ? <input type="hidden" name="force" value="1" /> : null}
        <CheckGroup
          legend="대학구분"
          name="univ"
          options={RATIO_UNIV_OPTIONS}
          picked={univ}
          onToggle={(value) => setUniv((prev) => toggled(prev, value))}
          help="2년제는 전문대·폴리텍·전공대학을 함께 봅니다."
        />
        <CheckGroup
          legend="모집구분"
          name="recruit"
          options={RATIO_RECRUIT_OPTIONS}
          picked={recruit}
          onToggle={(value) => setRecruit((prev) => toggled(prev, value))}
          help="정시는 가·나·다군을 모두 보고, 수시 재외국민은 빠집니다."
        />
        <p className="text-sm text-ink">
          기간: {RATIO_PERIOD_LABEL}(진행 중 + 오픈 예정)
        </p>
        {cooling ? (
          <p className="text-xs text-vermilion tabular-nums">
            최근 실행 후 쿨다운 {status.cooldownRemainingMinutes}분이 남았습니다
            — 실행하면 강제 실행됩니다.
          </p>
        ) : null}
        <p className="text-xs text-muted">
          실행하면 Moa 인증 문자가 1통 갑니다. 회사 PC 폴러가 5분 안에
          시작합니다.
        </p>
        {errorMessage ? (
          <p role="alert" className="text-xs text-vermilion">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}

// 경쟁률 두 잡의 [지금 실행] — 누르면 조건 창이 뜨고, 창의 [실행]이 적재한다
export function RatioRunControl({
  status,
  isAdmin,
}: {
  status: AutomationStatus;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    runRatioAuditAction,
    undefined,
  );
  // 창을 연 시점의 state — 이후에 바뀐 state 만 이번 창의 결과로 본다
  const [openedAgainst, setOpenedAgainst] = useState<{
    state: RunActionState;
  } | null>(null);
  const fresh = openedAgainst !== null && state !== openedAgainst.state;
  const succeeded = fresh && state?.ok === true;
  const open = openedAgainst !== null && !succeeded;
  const errorMessage = open && fresh && state ? state.message : null;
  const cooling = status.cooldownRemainingMinutes > 0;

  function handleOpen() {
    if (!isAdmin) {
      alert(ADMIN_ONLY_MSG);
      return;
    }
    setOpenedAgainst({ state });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleOpen}
        className={cooling ? RUN_COOLDOWN_CLASS : RUN_NOW_CLASS}
      >
        {cooling
          ? `쿨다운 ${status.cooldownRemainingMinutes}분 — 강제 실행`
          : "지금 실행"}
      </button>
      {open ? (
        <RatioRunDialog
          status={status}
          formAction={formAction}
          pending={pending}
          errorMessage={errorMessage}
          onClose={() => setOpenedAgainst(null)}
        />
      ) : null}
      {!open && state?.ok ? (
        <span className="text-xs text-ink">{state.message}</span>
      ) : null}
    </div>
  );
}
