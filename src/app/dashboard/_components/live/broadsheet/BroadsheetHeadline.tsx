import Link from "next/link";

import { selectHeadline, type HeadlineInput } from "../command/headline-selector";

export function BroadsheetHeadline({ input }: { input: HeadlineInput }) {
  const r = selectHeadline(input);

  return (
    <div className="mb-9 border-2 border-ink shadow-offset-sm bg-paper flex flex-col md:flex-row md:items-center justify-between p-5 gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-ink text-cream px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]">
            AUTO ▸ 우선순위 자동
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-vermilion">
            {r.kicker}
          </span>
        </div>
        <h2 className="text-3xl font-black leading-tight tracking-tight">
          {r.mode === "urgent" ? (
            // 긴급도 문구별 개별 링크 — 각 항목 클릭 시 해당 메뉴로 이동
            r.items.map((it, i) => (
              <span key={it.href}>
                {i > 0 && <span className="text-muted"> · </span>}
                <Link href={it.href} className="hover:underline">
                  {it.label}{" "}
                  <span className="text-vermilion tabular-nums">
                    {it.count}건
                  </span>
                </Link>
              </span>
            ))
          ) : (
            r.segments.map((seg, i) => (
              <span
                key={i}
                className={seg.em ? "text-vermilion tabular-nums" : ""}
              >
                {seg.text}
              </span>
            ))
          )}
        </h2>
        <p className="mt-2 text-sm text-muted">{r.sub}</p>
      </div>
      {r.mode === "urgent" && (
        <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-vermilion text-vermilion">
          <span className="text-2xl font-bold leading-none tabular-nums">
            {r.urgentTotal}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest mt-1">
            긴급
          </span>
        </div>
      )}
    </div>
  );
}
