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
  if (!sheet) {
    // 빈 표로 두면 잔액이 0원인 줄 안다.
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        전도금 장부를 읽지 못했습니다. SharePoint 접근 설정을 확인해 주세요.
      </p>
    );
  }

  const low = sheet.balance != null && sheet.balance < LOW_BALANCE;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b-2 border-ink pb-3">
        <div>
          <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
            현재 잔액
          </p>
          <p className="text-2xl font-bold tracking-[-0.01em] text-ink">
            {sheet.balance != null ? won(sheet.balance) : "—"}
          </p>
        </div>
        <p className="text-xs text-muted">
          올해 사용 {won(sheet.totalSpent)} · 기록{" "}
          {sheet.entries.filter((e) => e.kind === "spend").length}건
        </p>
        {low && (
          <p className="ml-auto bg-vermilion/10 px-2 py-1 text-2xs text-vermilion">
            잔액이 적습니다 — 전도금 청구를 준비하세요
          </p>
        )}
      </div>

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
            {/* 장부는 위가 오래된 것 — 최근을 먼저 본다 */}
            {[...sheet.entries].reverse().map((e, i) =>
              e.kind === "refill" ? (
                // 청구를 사용과 같은 모양으로 두면 잔액이 튀어 보인다.
                <tr key={i} className="border-b border-line-soft bg-situation-bg">
                  <td className="px-3 py-2 text-xs text-muted" colSpan={4}>
                    전도금 청구 — {e.before != null ? won(e.before) : "—"} 남은 상태에서
                    채움
                  </td>
                  <td className="px-3 py-2 font-mono text-sm text-ink">
                    {e.balance != null ? won(e.balance) : "—"}
                  </td>
                </tr>
              ) : (
                <tr key={i} className="border-b border-line-soft hover:bg-line-soft">
                  <td className="px-3 py-2 text-sm text-ink-soft">{e.date}</td>
                  <td className="px-3 py-2 text-sm text-ink">
                    {e.title}
                    {e.item && (
                      <span className="ml-1 text-2xs text-muted">· {e.item}</span>
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
    </div>
  );
}
