import type { ReactNode } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";
import {
  formatYmdWithWeekday,
  dayDiffFromToday,
  parseFiscalFromSheet,
} from "@/features/payment-dates/detail";

/**
 * 비용지급일 인스펙터 (읽기전용). SharePoint Excel `NN기비용지급일` 시트가 원본이라 편집 없음.
 * ScheduleView와 동일한 다중 Section 톤: 기본 / 회계 / 출처.
 */
function kstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ddayBadge(diff: number | null): { text: string; className: string } {
  if (diff === null) return { text: "-", className: "text-muted" };
  if (diff > 0) return { text: `D-${diff}`, className: "bg-indigo text-cream" };
  if (diff === 0) return { text: "오늘", className: "bg-vermilion text-cream" };
  return {
    text: `${Math.abs(diff)}일 지남`,
    className: "bg-line-soft text-muted",
  };
}

export function PaymentView({ row }: ViewProps) {
  const category = row.paymentCategory ?? "";
  const isPersonal = category.includes("개인");
  const ymd = row.startDateYmd ?? "";
  const diff = ymd ? dayDiffFromToday(ymd, kstTodayYmd()) : null;
  const dday = ddayBadge(diff);
  const { term, fiscal } = parseFiscalFromSheet(row.paymentSheet ?? "");

  const basicItems: { term: string; desc: ReactNode }[] = [
    {
      term: "구분",
      desc: (
        <span
          className={`inline-block px-2 py-0.5 text-xs ${
            isPersonal ? "bg-gold text-cream" : "bg-green-light text-cream"
          }`}
        >
          {category ? `${category}비용` : "-"}
        </span>
      ),
    },
    { term: "지급일", desc: formatYmdWithWeekday(ymd) },
    {
      term: "상태",
      desc: (
        <span className={`inline-block px-2 py-0.5 text-xs ${dday.className}`}>
          {dday.text}
        </span>
      ),
    },
  ];

  const fiscalItems: { term: string; desc: ReactNode }[] = [
    { term: "기수", desc: term ?? "-" },
    { term: "회계연도", desc: fiscal ?? "-" },
  ];

  return (
    <div className="space-y-6">
      <Section title="기본">
        <DefList items={basicItems} />
      </Section>

      <Divider />

      <Section title="회계">
        <DefList items={fiscalItems} />
      </Section>

      <Divider />

      <Section title="출처">
        <DefList
          items={[
            { term: "시트", desc: row.paymentSheet ?? "-" },
            {
              term: "원본",
              desc: (
                <span className="text-xs text-muted">
                  SharePoint Excel · 읽기 전용
                </span>
              ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
