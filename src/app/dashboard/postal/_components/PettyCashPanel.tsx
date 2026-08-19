"use client";

import { useMemo, useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";
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

export function PettyCashPanel({ sheet }: { sheet: PettyCashSheet | null }) {
  const [q, setQ] = useState("");

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

  const low = sheet.balance != null && sheet.balance < LOW_BALANCE;
  const lastRefill = [...sheet.entries]
    .reverse()
    .find((e) => e.kind === "refill");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="현재 잔액"
          value={sheet.balance != null ? won(sheet.balance) : "—"}
          tone={low ? "warn" : "strong"}
          note={low ? "청구를 준비하세요" : undefined}
        />
        <StatCard label="올해 사용" value={won(sheet.totalSpent)} />
        <StatCard label="사용 건수" value={`${spends.length}건`} />
        <StatCard
          label="마지막 청구"
          value={
            lastRefill && lastRefill.kind === "refill" && lastRefill.balance != null
              ? won(lastRefill.balance)
              : "—"
          }
          note={
            lastRefill && lastRefill.kind === "refill" && lastRefill.before != null
              ? `${won(lastRefill.before)} 남았을 때`
              : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">사용 내역</h3>
          <ListSearch
            value={q}
            onChange={setQ}
            ariaLabel="전도금 검색"
            placeholder="날짜 · 내용 · 금액"
            className="w-full sm:w-72"
          />
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
                      <td className="px-3 py-2 font-mono text-sm text-ink">
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
                      <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                        {e.count ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-sm text-ink">
                        {e.amount != null ? won(e.amount) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-sm text-muted">
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
    </div>
  );
}

/** 현황 카드 — 운영리포트 KPI와 같은 톤이되 증감이 없어 더 단순하다. */
function StatCard({
  label,
  value,
  note,
  tone = "normal",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "normal" | "strong" | "warn";
}) {
  const valueClass =
    tone === "warn"
      ? "text-vermilion"
      : tone === "strong"
        ? "text-ink"
        : "text-ink-soft";
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span
        className={`text-xl font-bold tabular-nums tracking-[-0.01em] ${valueClass}`}
      >
        {value}
      </span>
      {note && <span className="text-2xs text-muted">{note}</span>}
    </div>
  );
}
