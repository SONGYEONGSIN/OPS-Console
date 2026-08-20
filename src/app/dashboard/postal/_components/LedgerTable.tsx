"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListPagination } from "@/components/common/ListPagination";
import { ModalShell } from "@/components/common/ModalShell";
import type { LedgerLine } from "@/features/postal/ledger";
import {
  filterLedger,
  groupByMonth,
  LEDGER_PAGE_SIZE,
} from "@/features/postal/ledger-filter";

/**
 * 등기관리대장 — 이 화면의 주인공.
 *
 * 예전에는 **영수증 목록**이 표를 차지하고 대장은 엑셀에만 있었다. 그래서 "그날 발송이
 * 대장에 제대로 들어갔나"를 화면에서 확인할 수 없었다(2026-08-20 지적).
 *
 * 확인해야 할 것은 "영수증이 어디 있나"가 아니라 **"증빙 없는 행이 있나"** 다.
 * 월 묶음마다 `등기 N건 · 영수증 M장`을 적어, 빈칸이 스스로 드러나게 한다.
 *
 * **표는 하나다.** 묶음마다 `<table>`을 따로 그렸더니 브라우저가 표마다 열 너비를
 * 따로 재서 묶음끼리 열이 어긋났다. 날짜는 표 안의 그룹 행으로 넣는다.
 */

const COLUMNS = [
  "순번",
  "수신처",
  "수신자",
  "담당자",
  "확인",
  "등기번호",
  "비고",
  "증빙",
] as const;

export function LedgerTable({
  rows,
  receiptUrls,
  years = [],
  year,
}: {
  rows: LedgerLine[];
  /** 영수증 id → 서명 URL. 만료돼 없으면 버튼을 아예 만들지 않는다. */
  receiptUrls: Record<string, string>;
  /** 고를 수 있는 연도 — 시트가 곧 연도라 시트 목록에서 온다. */
  years?: number[];
  year?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const filtered = useMemo(() => filterLedger(rows, q), [rows, q]);
  // 페이지는 행 기준으로 끊는다 — 묶음 기준이면 페이지 길이가 들쭉날쭉해진다.
  const pageRows = useMemo(
    () =>
      filtered.slice((page - 1) * LEDGER_PAGE_SIZE, page * LEDGER_PAGE_SIZE),
    [filtered, page],
  );
  const groups = useMemo(() => groupByMonth(pageRows), [pageRows]);

  function goYear(y: number) {
    const next = new URLSearchParams(params.toString());
    next.set("year", String(y));
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <ListSearch
        value={q}
        onChange={setQ}
        ariaLabel="등기내역 검색"
        placeholder="수신처·수신자·담당자·등기번호 검색"
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-bold text-ink">등기관리대장</h3>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{filtered.length}건</span>
        </div>
        {/* 연도는 고를 수 있는 것이다 — 제목 옆 회색 글씨로 두면 표기로만 보인다. */}
        {years.length > 0 && (
          <div className="inline-flex">
            {years.map((y) => {
              const on = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={on}
                  onClick={() => goYear(y)}
                  className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
                    on ? "font-bold text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {y}년
                  {on && (
                    <span
                      aria-hidden
                      className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {filtered.length === 0 ? (
        <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
          {rows.length === 0
            ? "대장에 기록된 발송이 없습니다."
            : "찾는 발송이 없습니다."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-[0.08em] text-muted">
                  {COLUMNS.map((c) => (
                    <th key={c} className="py-2 pr-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([month, list]) => {
                  const receipts = new Set(
                    list.map((r) => r.receiptId).filter(Boolean) as string[],
                  );
                  return (
                    <GroupRows
                      key={month}
                      month={month}
                      list={list}
                      receiptCount={receipts.size}
                      receiptUrls={receiptUrls}
                      onOpen={setOpen}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination total={filtered.length} pageSize={LEDGER_PAGE_SIZE} />
        </>
      )}

      {open && (
        <ModalShell title="등기발송 영수증" onClose={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open}
            alt="등기발송 영수증 원본"
            className="max-h-[75vh] w-full object-contain"
          />
        </ModalShell>
      )}
    </div>
  );
}

/** 월 머리 + 그달 행들. 같은 표 안에 있어야 열이 어긋나지 않는다. */
function GroupRows({
  month,
  list,
  receiptCount,
  receiptUrls,
  onOpen,
}: {
  month: string;
  list: LedgerLine[];
  receiptCount: number;
  receiptUrls: Record<string, string>;
  onOpen: (url: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={COLUMNS.length} className="pb-1 pt-5">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-medium text-ink">{month}</span>
            <span className="text-2xs tabular-nums text-muted">
              등기 {list.length}건 · 영수증 {receiptCount}장
            </span>
            {receiptCount === 0 && (
              // 이게 확인해야 할 신호다 — 그달 발송에 증빙이 안 붙었다.
              <span className="text-2xs text-vermilion">증빙 없음</span>
            )}
          </div>
        </td>
      </tr>
      {list.map((r, i) => {
        const url = r.receiptId ? receiptUrls[r.receiptId] : undefined;
        return (
          <tr
            key={`${r.trackingNo}-${i}`}
            className="border-t border-line-soft transition-colors hover:bg-line-soft"
          >
            <td className="py-2 pr-3 tabular-nums text-muted">{r.seq ?? ""}</td>
            <td className="py-2 pr-3 text-ink">{r.recipientOrg}</td>
            <td className="py-2 pr-3 text-ink">{r.recipientName}</td>
            <td className="py-2 pr-3 text-ink-soft">{r.assignee}</td>
            <td className="py-2 pr-3 text-ink-soft">{r.confirmedBy}</td>
            {/* 화면의 다른 숫자와 같은 폰트 + 자릿수 정렬 (design.md 숫자 표기) */}
            <td className="py-2 pr-3 tabular-nums text-ink">{r.trackingNo}</td>
            <td className="py-2 pr-3 text-muted">{r.note}</td>
            <td className="py-2">
              {url ? (
                <button
                  type="button"
                  onClick={() => onOpen(url)}
                  className="cursor-pointer border-none bg-transparent p-0 text-2xs text-vermilion underline-offset-2 hover:underline"
                >
                  영수증
                </button>
              ) : (
                // 눌러도 안 열리는 버튼은 고장으로 보인다. 아예 안 만든다.
                <span className="text-2xs text-muted">—</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
