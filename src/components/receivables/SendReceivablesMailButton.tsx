"use client";

import { useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  fetchReminderGroup,
  sendReminderEmails,
} from "@/features/receivables/mail-actions";
import type {
  ExcludedReason,
  OperatorReminderGroup,
  SendReminderResult,
} from "@/features/receivables/mail-schemas";

type Props = {
  /** 현재 인스펙터에서 보고 있는 행의 학교담당자 이메일 */
  email: string;
  /** 현재 행의 거래처명 — 단건 발송 시 대상 행을 특정 */
  customerName: string;
  /** dryRun 모드 여부 — 페이지에서 ENV 값 기반으로 전달 */
  dryRun: boolean;
};

type Phase = "idle" | "loading" | "preview" | "done";

const BLOCKED_LABEL: Record<string, string> = {
  operator_email_not_mapped: "운영자 이메일 매핑 실패",
  operator_not_found: "운영자 미지정",
  invalid_email: "학교담당자 이메일 형식 오류",
};

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 청구건 1행 — 거래처(좌) · 경과일 chip · 금액(우 정렬). */
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

/** 운영자 1명분 섹션 — 헤더(운영자명 · 발신 메일박스 · 소계) + 청구건 목록 */
function OperatorGroupSection({
  group,
  currentCustomerName,
}: {
  group: OperatorReminderGroup;
  currentCustomerName: string;
}) {
  return (
    <div className="space-y-1" data-testid="operator-group">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <strong className="shrink-0 text-ink">{group.sender.name}</strong>
          <span className="truncate text-2xs text-muted">
            발신 {group.sender.email}
          </span>
        </span>
        <span className="shrink-0 text-muted">
          {group.items.length}건 ·{" "}
          <strong className="tabular-nums text-ink">
            {formatWon(group.totalAmount)}
          </strong>
        </span>
      </div>
      <ul className="border border-line-soft bg-white px-3 text-xs text-ink">
        {group.items.map((it, idx) => (
          <ReminderItemRow
            key={idx}
            customerName={it.customerName}
            daysOverdue={it.daysOverdue}
            amount={it.amount}
            current={it.customerName === currentCustomerName}
          />
        ))}
      </ul>
    </div>
  );
}

/** 운영자 매핑 실패 등으로 발송에서 빠지는 행 안내 */
function BlockedBanner({ blocked }: { blocked: ExcludedReason[] }) {
  return (
    <div
      className="border border-vermilion-deep bg-washi-raised px-3 py-2 text-xs text-vermilion-deep"
      data-testid="blocked-banner"
    >
      <strong>발송 제외 {blocked.length}건</strong> — 관리자 확인 필요
      <ul className="mt-1 space-y-0.5">
        {blocked.map((b, idx) => (
          <li key={idx}>
            · {b.customerName || `행 ${b.rowIndex + 1}`} —{" "}
            {BLOCKED_LABEL[b.reason] ?? b.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 인스펙터의 미수채권 행에서 학교담당자에게 독려 메일을 발송하는 트리거.
 *
 * 발신 메일박스는 채권 담당 운영자 본인 — admin이 대신 눌러도 운영자 이름으로 나간다.
 * 한 학교담당자에 여러 운영자의 청구건이 걸리면 운영자별로 N통 분리 발송된다.
 *
 * 흐름:
 *  1. 버튼 클릭 → fetchReminderGroup(email) 으로 (운영자별) 그룹 + 제외 사유 조회
 *  2. preview 모달에서 운영자별 섹션 확인, 청구건이 2건 이상이면 단건/묶음 선택
 *  3. '발송' → sendReminderEmails (수신자·범위만 전달, 발신자는 서버가 재도출)
 */
export function SendReceivablesMailButton({
  email,
  customerName,
  dryRun,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [groups, setGroups] = useState<OperatorReminderGroup[]>([]);
  const [blocked, setBlocked] = useState<ExcludedReason[]>([]);
  const [scope, setScope] = useState<"single" | "bundle">("bundle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendReminderResult | null>(null);
  // useTransition 대신 일반 로딩 플래그 — 서버 액션의 revalidate refresh와
  // 결과 setState가 엮여 'done' 전환이 누락(모달이 사라지는 듯 보임)되는 것 방지.
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setPhase("idle");
    setGroups([]);
    setBlocked([]);
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
      if (r.groups.length === 0 && r.blocked.length === 0) {
        setError(
          `이 학교담당자(${email})에 해당하는 미수 청구건(경과일수 ≥ ${r.thresholdDays}일)이 없습니다.`,
        );
        setPhase("done");
        return;
      }
      setGroups(r.groups);
      setBlocked(r.blocked);
      setPhase("preview");
    })();
  }

  /** 화면에 보여줄 그룹 — single scope면 현재 행이 속한 그룹의 해당 청구건만 */
  function visibleGroups(): OperatorReminderGroup[] {
    if (scope === "bundle") return groups;
    for (const g of groups) {
      const item = g.items.find((it) => it.customerName === customerName);
      if (item) return [{ ...g, items: [item], totalAmount: item.amount }];
    }
    return [];
  }

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const shown = visibleGroups();
  const canSend = phase === "preview" && shown.length > 0;

  async function onSend() {
    if (!canSend) return;
    setBusy(true);
    try {
      const r = await sendReminderEmails({
        recipientEmail: email,
        scope,
        customerName,
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

      {open && (
        <ModalShell
          title="미수채권 독려 메일 발송"
          ariaLabel="미수채권 독려 메일 발송"
          onClose={reset}
          size="xl"
          footer={
            <>
              <button
                type="button"
                onClick={reset}
                className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-xs text-ink hover:bg-washi"
              >
                닫기
              </button>
              {canSend ? (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={busy}
                  data-testid="confirm-send"
                  className="cursor-pointer border border-ink bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:text-cream/70"
                >
                  {busy ? "발송 중..." : dryRun ? "Dry-run 발송" : "발송"}
                </button>
              ) : null}
            </>
          }
        >
          <div className="text-sm">
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
            ) : phase === "preview" ? (
              <div className="space-y-3" data-testid="preview">
                {shown.length > 1 ? (
                  <p
                    className="bg-washi-raised px-3 py-2 text-xs text-ink"
                    data-testid="multi-sender-notice"
                  >
                    이 학교담당자에 <strong>{shown.length}명</strong>의 운영자
                    청구건이 있어 운영자별로 <strong>{shown.length}통</strong>이
                    발송됩니다.
                  </p>
                ) : null}

                {blocked.length > 0 ? (
                  <BlockedBanner blocked={blocked} />
                ) : null}

                {shown.map((g) => (
                  <OperatorGroupSection
                    key={g.sender.email}
                    group={g}
                    currentCustomerName={customerName}
                  />
                ))}

                {shown.length === 0 ? (
                  <p className="py-2 text-xs text-muted">
                    발송 가능한 운영자 매핑이 없습니다. 시트의 운영자명을
                    확인하세요.
                  </p>
                ) : null}

                {totalItems > 1 ? (
                  <div className="flex justify-end gap-2 border-t border-line-soft pt-2">
                    <button
                      type="button"
                      onClick={() => setScope("single")}
                      aria-pressed={scope === "single"}
                      className={`border px-3 py-1.5 text-xs ${
                        scope === "single"
                          ? "border-ink bg-ink font-semibold text-white"
                          : "border-ink/20 bg-white text-ink hover:bg-washi-raised"
                      }`}
                      data-testid="scope-single"
                    >
                      현재 행 1건만
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("bundle")}
                      aria-pressed={scope === "bundle"}
                      className={`border px-3 py-1.5 text-xs ${
                        scope === "bundle"
                          ? "border-ink bg-ink font-semibold text-white"
                          : "border-ink/20 bg-white text-ink hover:bg-washi-raised"
                      }`}
                      data-testid="scope-bundle"
                    >
                      {totalItems}건 묶음 (운영자별 {groups.length}통)
                    </button>
                  </div>
                ) : null}
              </div>
            ) : phase === "done" && result ? (
              <div
                role="status"
                className="border border-ink/10 bg-washi-raised px-3 py-2 text-xs"
                data-testid="send-result"
              >
                {result.ok ? (
                  <>
                    <strong className="text-green-700">발송 완료</strong> — 성공{" "}
                    {result.sentCount} · 실패 {result.failedCount} · Dry-run{" "}
                    {result.dryRunCount} · 제외 {result.blockedCount}
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
        </ModalShell>
      )}
    </>
  );
}
