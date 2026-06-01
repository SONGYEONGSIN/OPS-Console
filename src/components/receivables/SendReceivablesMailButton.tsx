"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchReminderGroup,
  sendReminderEmails,
} from "@/features/receivables/mail-actions";
import type {
  ReminderGroup,
  SendReminderResult,
} from "@/features/receivables/mail-schemas";

type Props = {
  /** 현재 인스펙터에서 보고 있는 행의 학교담당자 이메일 */
  email: string;
  /** 현재 행의 거래처명 (단건 발송 시 fallback 라벨용) */
  customerName: string;
  /** dryRun 모드 여부 — 페이지에서 ENV 값 기반으로 전달 */
  dryRun: boolean;
};

type Phase = "idle" | "loading" | "select-scope" | "preview" | "done";

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 청구건 1행 — 거래처(좌) · 경과일 chip · 금액(우 정렬). 미리보기/스코프 선택 공용. */
function ReminderItemRow({
  customerName,
  daysOverdue,
  amount,
  current = false,
}: {
  customerName: string;
  daysOverdue: number;
  amount: number;
  current?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft py-1.5 last:border-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={`truncate ${current ? "font-semibold text-ink" : "text-ink"}`}
        >
          {customerName}
        </span>
        {current ? (
          <span className="shrink-0 text-2xs text-muted">(현재 행)</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="bg-washi-raised px-1.5 py-0.5 text-2xs text-muted">
          D+{daysOverdue}
        </span>
        <span className="w-20 text-right text-xs tabular-nums text-ink">
          {formatWon(amount)}
        </span>
      </span>
    </li>
  );
}

/**
 * 인스펙터의 미수채권 행에서 학교담당자에게 독려 메일을 발송하는 트리거.
 *
 * 흐름:
 *  1. 버튼 클릭 → fetchReminderGroup(email) 으로 같은 이메일의 모든 미수 청구건 조회
 *  2. 청구건이 1건뿐이면: 바로 preview 모달
 *  3. 2건 이상이면: '단건만/묶음' 선택 화면 → preview 모달
 *  4. preview 모달에서 '발송' → sendReminderEmails
 *  5. 결과 토스트 표시
 */
export function SendReceivablesMailButton({
  email,
  customerName,
  dryRun,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [group, setGroup] = useState<ReminderGroup | null>(null);
  const [scope, setScope] = useState<"single" | "bundle">("bundle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendReminderResult | null>(null);
  // useTransition 대신 일반 로딩 플래그 — 서버 액션의 revalidate refresh와
  // 결과 setState가 엮여 'done' 전환이 누락(모달이 사라지는 듯 보임)되는 것 방지.
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setPhase("idle");
    setGroup(null);
    setScope("bundle");
    setError(null);
    setResult(null);
  }

  function trigger() {
    if (!email) {
      setError("학교담당자 이메일을 찾을 수 없습니다.");
      setOpen(true);
      setPhase("done");
      return;
    }
    setOpen(true);
    setPhase("loading");
    void (async () => {
      const r = await fetchReminderGroup(email);
      if (!r.sheetAvailable) {
        setError("SharePoint Excel을 불러올 수 없습니다.");
        setPhase("done");
        return;
      }
      if (!r.group) {
        setError(
          `이 학교담당자(${email})에 해당하는 미수 청구건(경과일수 ≥ ${r.thresholdDays}일)이 없습니다.`,
        );
        setPhase("done");
        return;
      }
      setGroup(r.group);
      // 2건 이상이면 단건/묶음 선택, 1건이면 바로 preview
      setPhase(r.group.items.length > 1 ? "select-scope" : "preview");
    })();
  }

  function effectiveGroup(): ReminderGroup | null {
    if (!group) return null;
    if (scope === "bundle" || group.items.length === 1) return group;
    // 단건: 현재 행의 거래처명과 일치하는 첫 item만 (없으면 첫 번째)
    const match =
      group.items.find((it) => it.customerName === customerName) ??
      group.items[0];
    return {
      recipient: group.recipient,
      items: [match],
      totalAmount: match.amount,
    };
  }

  async function onSend() {
    const eg = effectiveGroup();
    if (!eg) return;
    setBusy(true);
    try {
      const r = await sendReminderEmails({
        // action 자체는 threshold 사용 안 함. zod positive 통과용 1 전달.
        thresholdDays: 1,
        groups: [eg],
        dryRun,
      });
      setResult(r);
      setPhase("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        disabled={!email || busy}
        className="inline-flex items-center gap-2 border border-ink/20 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-washi-raised disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="inspector-send-mail"
      >
        독려 메일 발송
      </button>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="send-receivables-mail-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) reset();
              }}
            >
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-ink/15 bg-cream shadow-xl">
                <header className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
                  <h2
                    id="send-receivables-mail-title"
                    className="text-base font-semibold text-ink"
                  >
                    미수채권 독려 메일 발송
                  </h2>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-muted hover:text-ink"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-line-soft pb-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-2xs uppercase tracking-wide text-muted">
                        수신자
                      </span>
                      <span className="truncate text-sm font-medium text-ink">
                        {email}
                      </span>
                    </div>
                    {dryRun ? (
                      <span className="shrink-0 bg-gold px-1.5 py-0.5 text-2xs font-semibold text-cream">
                        DRY-RUN
                      </span>
                    ) : (
                      <span className="shrink-0 bg-vermilion-deep px-1.5 py-0.5 text-2xs font-semibold text-cream">
                        실발송
                      </span>
                    )}
                  </div>

                  {phase === "loading" ? (
                    <div className="py-8 text-center text-xs text-muted">
                      대상 조회 중...
                    </div>
                  ) : phase === "select-scope" && group ? (
                    <div className="space-y-3" data-testid="select-scope">
                      <p className="text-sm text-ink">
                        이 학교담당자에게{" "}
                        <strong>
                          다른 미수 청구건 {group.items.length - 1}건
                        </strong>
                        이 있습니다. 함께 묶어서 1통으로 보낼까요?
                      </p>
                      <ul className="border border-line-soft bg-white px-3 text-xs">
                        {group.items.map((it, idx) => (
                          <ReminderItemRow
                            key={idx}
                            customerName={it.customerName}
                            daysOverdue={it.daysOverdue}
                            amount={it.amount}
                            current={it.customerName === customerName}
                          />
                        ))}
                      </ul>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScope("single");
                            setPhase("preview");
                          }}
                          className="border border-ink/20 bg-white px-3 py-1.5 text-xs text-ink hover:bg-washi-raised"
                          data-testid="scope-single"
                        >
                          현재 행 1건만
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScope("bundle");
                            setPhase("preview");
                          }}
                          className="border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                          data-testid="scope-bundle"
                        >
                          {group.items.length}건 묶음 발송
                        </button>
                      </div>
                    </div>
                  ) : phase === "preview" && effectiveGroup() ? (
                    <div className="space-y-2" data-testid="preview">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted">
                          청구건{" "}
                          <strong className="text-ink">
                            {effectiveGroup()!.items.length}건
                          </strong>
                        </span>
                        <span className="text-muted">
                          합계{" "}
                          <strong className="text-sm tabular-nums text-ink">
                            {formatWon(effectiveGroup()!.totalAmount)}
                          </strong>
                        </span>
                      </div>
                      <ul className="border border-line-soft bg-white px-3 text-xs text-ink">
                        {effectiveGroup()!.items.map((it, idx) => (
                          <ReminderItemRow
                            key={idx}
                            customerName={it.customerName}
                            daysOverdue={it.daysOverdue}
                            amount={it.amount}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : phase === "done" && result ? (
                    <div
                      role="status"
                      className="border border-ink/10 bg-washi-raised px-3 py-2 text-xs"
                      data-testid="send-result"
                    >
                      {result.ok ? (
                        <>
                          <strong className="text-green-700">발송 완료</strong>{" "}
                          — 성공 {result.sentCount} · 실패 {result.failedCount}{" "}
                          · Dry-run {result.dryRunCount}
                        </>
                      ) : (
                        <strong className="text-vermilion-deep">
                          실패: {result.error}
                        </strong>
                      )}
                    </div>
                  ) : phase === "done" && error ? (
                    <div
                      role="status"
                      className="border border-vermilion-deep bg-washi-raised px-3 py-2 text-xs text-vermilion-deep"
                      data-testid="send-error"
                    >
                      {error}
                    </div>
                  ) : null}
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-ink/10 px-5 py-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink hover:bg-washi-raised"
                  >
                    닫기
                  </button>
                  {phase === "preview" ? (
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={busy}
                      className="border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      data-testid="confirm-send"
                    >
                      {busy ? "발송 중..." : dryRun ? "Dry-run 발송" : "발송"}
                    </button>
                  ) : null}
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
