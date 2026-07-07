import { Section, DefList } from "../shared";
import type { ViewProps } from "../types";

/**
 * 비용지급일 인스펙터 (읽기전용). SharePoint Excel `NN기비용지급일` 시트가 원본이라 편집 없음.
 * 날짜는 ListRow.startDateYmd, 구분은 paymentCategory, 출처는 paymentSheet 재사용.
 */
function formatYmd(ymd?: string): string {
  if (!ymd) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

export function PaymentView({ row }: ViewProps) {
  const category = row.paymentCategory ?? "";
  const isPersonal = category.includes("개인");

  return (
    <div className="space-y-6">
      <Section title="비용지급일">
        <DefList
          items={[
            { term: "지급일", desc: formatYmd(row.startDateYmd ?? undefined) },
            {
              term: "구분",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${
                    isPersonal
                      ? "bg-gold text-cream"
                      : "bg-green-light text-cream"
                  }`}
                >
                  {category ? `${category}비용` : "-"}
                </span>
              ),
            },
            { term: "출처 시트", desc: row.paymentSheet ?? "-" },
          ]}
        />
      </Section>
    </div>
  );
}
