"use client";

import { useMemo, useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";
import { SpendForm } from "./SpendForm";
import { KpiCard, type KpiCardItem } from "@/components/common/KpiCard";
import type { PettyCashSheet } from "@/features/petty-cash/parse";

/**
 * 전도금 장부 — `2026년도 전도금 비용.xlsx` 를 읽어 보여준다.
 *
 * 원본은 엑셀이고 사람이 거기서도 고친다. DB로 옮겨 담지 않고 그때그때 읽는다 —
 * 복제해 두면 어느 쪽이 맞는지 알 수 없게 된다.
 */

/** 이 밑으로 떨어지면 채울 때가 됐다. 우편 발송이 막히기 전에 알린다. */
const LOW_BALANCE = 100_000;

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function PettyCashPanel({
  sheet,
  pettyCashUrl = null,
}: {
  sheet: PettyCashSheet | null;
  /** 원본 엑셀 바로가기. 조회 실패면 null — 버튼을 아예 안 그린다. */
  pettyCashUrl?: string | null;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const spends = useMemo(
    () => (sheet?.entries ?? []).filter((e) => e.kind === "spend"),
    [sheet],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // 최근을 먼저 본다 — 장부는 위가 오래된 것이다.
    const rows = [...(sheet?.entries ?? [])].reverse();
    if (!needle) return rows;
    // 검색 중에는 청구 행을 뺀다 — 검색어와 무관한 줄이 섞이면 헷갈린다.
    return rows.filter(
      (e) =>
        e.kind === "spend" &&
        [e.date, e.title, e.item ?? "", String(e.amount ?? "")]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    );
  }, [sheet, q]);

  if (!sheet) {
    // 빈 표로 두면 잔액이 0원인 줄 안다.
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        전도금 장부를 읽지 못했습니다. SharePoint 접근 설정을 확인해 주세요.
      </p>
    );
  }

  const lastRefill = [...sheet.entries]
    .reverse()
    .find((e) => e.kind === "refill");
  const lastRefillBalance =
    lastRefill && lastRefill.kind === "refill" ? lastRefill.balance : null;

  const low = sheet.balance != null && sheet.balance < LOW_BALANCE;

  const cards: KpiCardItem[] = [
    kpi("현재 잔액", sheet.balance ?? 0, "원"),
    kpi("올해 사용", sheet.totalSpent, "원"),
    kpi("사용 건수", spends.length, "건"),
    kpi("마지막 청구", lastRefillBalance ?? 0, "원"),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* 상단 카드는 운영리포트가 표준이다 — KpiCard 를 그대로 쓴다.
          비교 대상(직전 기간)이 없으므로 delta 는 전부 null 이고, 카드는
          '비교 불가'로 그린다. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      {/* 잔액 경고는 표 위에 — 카드가 '비교 불가'만 그려 눈에 안 띈다. */}
      {low && (
        <p className="border border-line-soft bg-situation-bg px-3 py-2 text-xs text-vermilion">
          잔액이 {won(sheet.balance ?? 0)}입니다 — 전도금 청구를 준비하세요
        </p>
      )}

      <div className="flex flex-col gap-3">
        {/* 검색은 목록 위 별도 줄(다른 메뉴의 controlsRow 자리). 검색 앞에 제목을
            붙이지 않는다 — 표준은 제목이 그 아래 헤더에 있다. */}
        <ListSearch
          value={q}
          onChange={setQ}
          ariaLabel="전도금 검색"
          placeholder="날짜·내용·금액 검색"
        />

        {/* 간격은 ListPattern 표준(검색 → 28px → 제목 → 16px → 표). */}
        <header className="mb-4 mt-7 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-ink">사용 내역</h3>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-sm text-vermilion">{spends.length}건</span>
          </div>
          {/*
            우편물은 영수증 판독으로 자동 기록되지만, 사무용품처럼 전도금으로 사는
            다른 것들은 넣을 길이 없어 엑셀을 직접 열어야 했다(2026-08-20).
          */}
          <div className="flex items-center gap-2">
          {/*
            원본 엑셀 바로가기 — 미수채권과 같은 규칙. 조회에 실패하면 버튼을
            아예 안 그린다: 깨진 링크를 누르게 하는 것보다 없는 편이 낫다.
          */}
          {pettyCashUrl && (
            <a
              href={pettyCashUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:bg-washi"
            >
              전도금대장
            </a>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream transition-opacity hover:opacity-90"
          >
            + 사용내역 추가
          </button>
          </div>
        </header>

        {visible.length === 0 ? (
          <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
            찾는 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">날짜</th>
                  <th className="px-3 py-2">내용</th>
                  <th className="px-3 py-2">건수</th>
                  <th className="px-3 py-2">금액</th>
                  <th className="px-3 py-2">잔액</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) =>
                  e.kind === "refill" ? (
                    // 청구를 사용과 같은 모양으로 두면 잔액이 튀어 보인다.
                    <tr
                      key={i}
                      className="border-b border-line-soft bg-situation-bg"
                    >
                      <td className="px-3 py-2 text-xs text-muted" colSpan={4}>
                        전도금 청구 —{" "}
                        {e.before != null ? won(e.before) : "—"} 남은 상태에서 채움
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums text-ink">
                        {e.balance != null ? won(e.balance) : "—"}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={i}
                      className="border-b border-line-soft hover:bg-line-soft"
                    >
                      <td className="px-3 py-2 text-sm text-ink-soft">{e.date}</td>
                      <td className="px-3 py-2 text-sm text-ink">
                        {e.title}
                        {e.item && (
                          <span className="ml-1 text-2xs text-muted">
                            · {e.item}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-ink-soft">
                        {e.count ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums text-ink">
                        {e.amount != null ? won(e.amount) : "—"}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums text-muted">
                        {e.balance != null ? won(e.balance) : "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <SpendForm onClose={() => setAdding(false)} />}
    </div>
  );
}

/**
 * KpiCard 가 요구하는 모양으로 감싼다.
 *
 * 전도금은 '직전 기간'이라는 게 없어 증감을 못 낸다 — delta 계열을 null 로 두면
 * 카드가 '비교 불가'로 그린다(리포트에서 비교 대상이 없을 때와 같은 처리).
 */
function kpi(label: string, value: number, unit: string): KpiCardItem {
  return {
    label,
    value,
    unit,
    prevValue: null,
    delta: null,
    deltaPct: null,
    goodOnIncrease: true,
  };
}
