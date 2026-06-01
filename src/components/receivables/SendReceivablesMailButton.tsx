"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
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
    });
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

  function onSend() {
    const eg = effectiveGroup();
    if (!eg) return;
    startTransition(async () => {
      const r = await sendReminderEmails({
        // action 자체는 threshold 사용 안 함. zod positive 통과용 1 전달.
        thresholdDays: 1,
        groups: [eg],
        dryRun,
      });
      setResult(r);
      setPhase("done");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        disabled={!email || isPending}
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
                  <p className="mb-3 text-xs text-muted">
                    수신자: <strong className="text-ink">{email}</strong>
                    {dryRun ? (
                      <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-900">
                        DRY-RUN
                      </span>
                    ) : (
                      <span className="ml-2 rounded bg-vermilion-deep px-1.5 py-0.5 font-semibold text-white">
                        실발송
                      </span>
                    )}
                  </p>

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
                      <ul className="space-y-1 border border-ink/10 bg-white p-3 text-xs">
                        {group.items.map((it, idx) => (
                          <li
                            key={idx}
                            className={
                              it.customerName === customerName
                                ? "font-semibold text-ink"
                                : "text-muted"
                            }
                          >
                            · {it.customerName} — D+{it.daysOverdue}{" "}
                            {formatWon(it.amount)}
                            {it.customerName === customerName
                              ? "  (현재 행)"
                              : ""}
                          </li>
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
                      <p className="text-xs text-muted">
                        포함 청구건 {effectiveGroup()!.items.length}건 · 합계{" "}
                        <strong className="text-ink">
                          {formatWon(effectiveGroup()!.totalAmount)}
                        </strong>
                      </p>
                      <ul className="space-y-1 border border-ink/10 bg-white p-3 text-xs text-ink">
                        {effectiveGroup()!.items.map((it, idx) => (
                          <li key={idx}>
                            · {it.customerName} — D+{it.daysOverdue}{" "}
                            {formatWon(it.amount)}
                          </li>
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
                      disabled={isPending}
                      className="border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      data-testid="confirm-send"
                    >
                      {isPending
                        ? "발송 중..."
                        : dryRun
                          ? "Dry-run 발송"
                          : "발송"}
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
