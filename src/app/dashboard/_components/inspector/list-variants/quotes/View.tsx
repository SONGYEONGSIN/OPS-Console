"use client";

import Link from "next/link";
import { Section, DefList } from "../shared";
import type { ViewProps } from "../types";
import { QUOTE_STATUS_LABEL } from "@/features/quotes/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";
import { formatKrw } from "./filters";

export function QuoteView({ row }: ViewProps) {
  const qs = row.quoteStatus ?? "draft";
  const statusLabel = QUOTE_STATUS_LABEL[qs];

  return (
    <div className="space-y-6 p-4">
      {/* 문서 작성/열기 진입 */}
      <Link
        href={`/dashboard/quotes/${row.id}`}
        className="inline-flex items-center border border-ink px-3 py-1.5 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
      >
        문서 작성 / 열기
      </Link>

      <Section title="견적 정보">
        <DefList
          items={[
            { term: "고객", desc: row.quoteCustomer || "—" },
            { term: "견적일", desc: row.quoteDate || "—" },
            { term: "금액", desc: formatKrw(row.quoteAmount) },
            {
              term: "담당",
              desc: operatorNameByEmail(row.quoteOwner) || row.quoteOwner || "—",
            },
            { term: "상태", desc: statusLabel },
            { term: "유효기간", desc: row.quoteValidUntil || "—" },
            {
              term: "비고",
              desc: row.quoteNote ? (
                <p className="whitespace-pre-wrap text-sm text-ink">
                  {row.quoteNote}
                </p>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
