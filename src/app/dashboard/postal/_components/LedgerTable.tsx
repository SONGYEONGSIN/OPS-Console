"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import type { LedgerLine } from "@/features/postal/ledger";

/**
 * 등기관리대장 — 이 화면의 주인공.
 *
 * 예전에는 **영수증 목록**이 표를 차지하고 대장은 엑셀에만 있었다. 그래서 "그날 발송이
 * 대장에 제대로 들어갔나"를 화면에서 확인할 수 없었다(2026-08-20 지적).
 *
 * 확인해야 할 것은 "영수증이 어디 있나"가 아니라 **"증빙 없는 행이 있나"** 다.
 * 날짜 묶음마다 `등기 N건 · 영수증 M장`을 적어, 빈칸이 스스로 드러나게 한다.
 *
 * **표는 하나다.** 날짜 묶음마다 `<table>`을 따로 그렸더니 브라우저가 표마다 열 너비를
 * 따로 재서, 묶음끼리 열이 어긋나 보였다. 날짜는 표 안의 그룹 행으로 넣는다.
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
  sheetName,
}: {
  rows: LedgerLine[];
  /** 영수증 id → 서명 URL. 만료돼 없으면 버튼을 아예 만들지 않는다. */
  receiptUrls: Record<string, string>;
  /** 어느 시트를 읽었는지 — 내년이면 시트가 바뀐다. */
  sheetName?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  // 최근 발송이 위로. 같은 날은 대장 순번 순서를 지킨다.
  const groups = useMemo(() => {
    const byDate = new Map<string, LedgerLine[]>();
    for (const r of rows) {
      const list = byDate.get(r.sentOn) ?? [];
      list.push(r);
      byDate.set(r.sentOn, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-bold text-ink">등기관리대장</h3>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{rows.length}건</span>
          {sheetName && (
            <span className="text-2xs text-muted">{sheetName}</span>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted">
          대장에 기록된 발송이 없습니다.
        </p>
      ) : (
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
            {groups.map(([date, list]) => {
              const receipts = new Set(
                list.map((r) => r.receiptId).filter(Boolean) as string[],
              );
              return (
                <GroupRows
                  key={date}
                  date={date}
                  list={list}
                  receiptCount={receipts.size}
                  receiptUrls={receiptUrls}
                  onOpen={setOpen}
                />
              );
            })}
          </tbody>
        </table>
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

/** 날짜 머리 + 그날 행들. 같은 표 안에 있어야 열이 어긋나지 않는다. */
function GroupRows({
  date,
  list,
  receiptCount,
  receiptUrls,
  onOpen,
}: {
  date: string;
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
            <span className="text-sm font-medium text-ink">{date}</span>
            <span className="text-2xs tabular-nums text-muted">
              등기 {list.length}건 · 영수증 {receiptCount}장
            </span>
            {receiptCount === 0 && (
              // 이게 확인해야 할 신호다 — 그날 발송에 증빙이 안 붙었다.
              <span className="text-2xs text-vermilion">증빙 없음</span>
            )}
          </div>
        </td>
      </tr>
      {list.map((r, i) => {
        const url = r.receiptId ? receiptUrls[r.receiptId] : undefined;
        return (
          <tr
            key={`${date}-${r.trackingNo}-${i}`}
            className="border-t border-line-soft transition-colors hover:bg-line-soft"
          >
            <td className="py-2 pr-3 tabular-nums text-muted">{r.seq ?? ""}</td>
            <td className="py-2 pr-3 text-ink">{r.recipientOrg}</td>
            <td className="py-2 pr-3 text-ink">{r.recipientName}</td>
            <td className="py-2 pr-3 text-ink-soft">{r.assignee}</td>
            <td className="py-2 pr-3 text-ink-soft">{r.confirmedBy}</td>
            {/* 등기번호는 한 글자씩 대조하는 값이라 mono */}
            <td className="py-2 pr-3 font-mono text-ink">{r.trackingNo}</td>
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
