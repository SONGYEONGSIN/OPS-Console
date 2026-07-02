import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

export function ContractsView({ row }: ViewProps) {
  // raw record를 정렬된 entries로 (빈 값 제외)
  const rawEntries = Object.entries(row.contractRaw ?? {}).filter(
    ([, v]) => String(v ?? "").trim() !== "",
  );

  return (
    <div className="space-y-6">
      <Section title="기본">
        <DefList
          items={[
            {
              term: "시트",
              desc: (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.contractSheet ?? "-"}
                </span>
              ),
            },
            {
              term: "넘버링",
              desc: (
                <span className="text-xs">{row.numbering || "-"}</span>
              ),
            },
            { term: "대학·학교명", desc: row.name || "-" },
            { term: "운영자", desc: row.owner || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="계약현황">
        <DefList
          items={[
            {
              term: "계약진행현황",
              desc: row.contractStatus || (
                <span className="text-vermilion">미완료</span>
              ),
            },
            {
              term: "서비스여부",
              desc:
                row.serviceActive === "Y" ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    Y
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                ),
            },
            { term: "수수료(VAT포함)", desc: row.feeAmount || "-" },
          ]}
        />
      </Section>

      {rawEntries.length > 0 && (
        <>
          <Divider />
          <Section title="전체 컬럼 (SharePoint 원본)">
            <DefList
              items={rawEntries.map(([header, value]) => ({
                term: header,
                desc: <span className="whitespace-pre-wrap text-sm">{value}</span>,
              }))}
            />
          </Section>
        </>
      )}
    </div>
  );
}
