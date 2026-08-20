"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/common/DateInput";
import { InspectorPanel } from "../../_components/inspector/InspectorPanel";
import { appendSpend } from "@/features/petty-cash/actions";

/**
 * 전도금 사용내역 직접 추가.
 *
 * 우편물은 영수증 판독으로 자동 기록되지만, **사무용품처럼 전도금으로 사는 다른
 * 것들**은 넣을 길이 없어 엑셀을 직접 열어야 했다(2026-08-20).
 *
 * 껍데기와 **안쪽 구성 모두** 인스펙터 표준을 따른다 — 처음엔 패널만 표준을 쓰고
 * 내용은 나름대로 짜서 다른 메뉴와 달라 보였다. 표준은 `InspectorChrome`이 정한다:
 * `인스펙터 · …` 라벨, 굵은 제목, 밑줄 헤더, `flex-1` 저장/취소.
 *
 * 넣는 자리는 서버가 정한다 — 날짜순을 지켜야 잔액 수식이 맞고, 충전 행을
 * 넘어가면 구간별 합계가 어긋난다.
 */

const FIELD =
  "w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white";

export type RecentSpend = {
  date: string;
  title: string;
  count: number | null;
  amount: number;
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function SpendForm({
  onClose,
  balance = null,
  recent = [],
}: {
  onClose: () => void;
  /** 지금 잔액. 못 읽었으면 null — 지어내지 않고 그 칸을 비운다. */
  balance?: number | null;
  /** 최근 사용 몇 건. 같은 걸 두 번 넣는 실수를 서버가 거절하기 전에 막는다. */
  recent?: RecentSpend[];
}) {
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
    <InspectorPanel open onClose={onClose}>
      {/* InspectorChrome과 같은 머리 — 다른 메뉴 인스펙터와 나란히 놓아도 같아 보인다. */}
      <header className="mb-6 border-b-2 border-ink pb-4">
        <div className="space-y-1">
          <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
            인스펙터 · 전도금
          </p>
          <h3 className="text-xl font-bold tracking-[-0.01em] text-ink">
            사용내역 추가
          </h3>
          <p className="text-xs text-muted">
            우편물 외에 전도금으로 쓴 것을 장부에 넣습니다.
          </p>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <label className="block text-xs">
          <span className="mb-1 block text-muted">
            날짜 <span className="text-2xs">(비우면 오늘)</span>
          </span>
          <DateInput
            aria-label="날짜"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted">내용</span>
          <input
            aria-label="내용"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="사무용품"
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted">건수</span>
            <input
              aria-label="건수"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">금액</span>
            <input
              aria-label="금액"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="block text-xs">
          <span className="mb-1 block text-muted">품목</span>
          <input
            aria-label="품목"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="A4용지"
            className={FIELD}
          />
        </label>

        {/*
          넣기 전에 판단할 재료 — 잔액이 얼마고, 이 건을 빼면 얼마가 남는가.
          모자라면 드러낸다: 숨기면 채워야 할 때를 놓친다.
        */}
        {balance != null && (
          <div className="space-y-1 border border-line-soft bg-situation-bg p-3 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-muted">현재 잔액</span>
              <span className="tabular-nums text-ink">{won(balance)}</span>
            </div>
            {Number(amount) > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-muted">넣으면 남는 금액</span>
                <span
                  className={`tabular-nums ${
                    balance - Number(amount) < 0
                      ? "text-vermilion-deep"
                      : "text-ink"
                  }`}
                >
                  {won(balance - Number(amount))}
                </span>
              </div>
            )}
            {Number(amount) > balance && (
              <p className="text-vermilion-deep">
                잔액을 넘습니다 — 전도금 청구가 필요할 수 있습니다
              </p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-vermilion-deep">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-60"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft disabled:opacity-60"
          >
            취소
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="mt-6 border-t border-line-soft pt-4">
          <h4 className="mb-2 text-2xs uppercase tracking-[0.12em] text-muted">
            최근 사용
          </h4>
          <ul className="space-y-1">
            {recent.map((r, i) => (
              <li
                key={`${r.date}-${r.amount}-${i}`}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="tabular-nums text-muted">{r.date}</span>
                <span className="flex-1 truncate text-ink">{r.title}</span>
                <span className="tabular-nums text-ink-soft">
                  {won(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </InspectorPanel>
  );
}

/** 날짜를 비우고 저장하면 오늘로 본다 — 대부분 그날 쓴 것을 그날 적는다. */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}
