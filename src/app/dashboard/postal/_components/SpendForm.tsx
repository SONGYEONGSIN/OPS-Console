"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalShell } from "@/components/common/ModalShell";
import { appendSpend } from "@/features/petty-cash/actions";

/**
 * 전도금 사용내역 직접 추가.
 *
 * 우편물은 영수증 판독으로 자동 기록되지만, **사무용품처럼 전도금으로 사는 다른
 * 것들**은 넣을 길이 없어 엑셀을 직접 열어야 했다(2026-08-20).
 *
 * 넣는 자리는 서버가 정한다 — 날짜순을 지켜야 잔액 수식이 맞고, 충전 행을
 * 넘어가면 구간별 합계가 어긋난다.
 */

const FIELD =
  "w-full border border-line-soft bg-field-bg px-3 py-2 text-sm text-ink focus:border-ink focus:bg-white focus:outline-none";

export function SpendForm({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("");
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const amountNum = Number(amount);
    // 0원짜리 줄이 장부에 남으면 안 되고, 무엇에 썼는지 없으면 장부가 아니다.
    if (!title.trim()) {
      setError("내용을 적어주세요");
      return;
    }
    if (!(amountNum > 0)) {
      setError("금액을 적어주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await appendSpend({
        date: date || todayKst(),
        title: title.trim(),
        count: count ? Number(count) : null,
        amount: amountNum,
        item: item.trim() || undefined,
      });
      if (!r.ok) {
        // 이유를 그대로 보여주고 창을 닫지 않는다 — 닫으면 다시 입력해야 한다.
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title="사용내역 추가" onClose={onClose}>
      <div className="space-y-3">
        <Field label="날짜">
          <input
            type="date"
            aria-label="날짜"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field label="내용">
          <input
            aria-label="내용"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="사무용품"
            className={FIELD}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="건수">
            <input
              aria-label="건수"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={FIELD}
            />
          </Field>
          <Field label="금액">
            <input
              aria-label="금액"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={FIELD}
            />
          </Field>
        </div>
        <Field label="품목">
          <input
            aria-label="품목"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="A4용지"
            className={FIELD}
          />
        </Field>

        {error && <p className="text-xs text-vermilion-deep">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:bg-washi"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-2xs uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

/** 날짜를 비우고 저장하면 오늘로 본다 — 대부분 그날 쓴 것을 그날 적는다. */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}
