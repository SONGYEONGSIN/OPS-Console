import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function ServicesView({ row }: ViewProps) {
  const operatorLabel = row.operatorName || row.operatorEmail || "-";
  const developerLabel = row.developerName || row.developerEmail || "-";

  return (
    <div className="space-y-6">
      <Section title="서비스 기본">
        <DefList
          items={[
            {
              term: "service_id",
              desc: (
                <span className="font-mono">
                  {row.serviceIdNum != null ? String(row.serviceIdNum) : "-"}
                </span>
              ),
            },
            { term: "대학명", desc: row.universityName ?? "-" },
            { term: "서비스명", desc: row.serviceName ?? "-" },
            {
              term: "카테고리",
              desc: row.category ? (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.category}
                </span>
              ) : (
                "-"
              ),
            },
            {
              term: "접수구분",
              desc: row.applicationType ? (
                <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-muted">
                  {row.applicationType}
                </span>
              ) : (
                "-"
              ),
            },
            { term: "지역", desc: row.region ?? "-" },
            { term: "대학구분", desc: row.universityType ?? "-" },
            {
              term: "단독여부",
              desc: row.solo ? (
                <span className="inline-block bg-vermilion px-2 py-0.5 text-xs text-cream">
                  단독
                </span>
              ) : (
                <span className="text-xs text-muted">공동</span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="담당">
        <DefList
          items={[
            { term: "운영자", desc: operatorLabel },
            { term: "개발자", desc: developerLabel },
          ]}
        />
      </Section>

      <Divider />

      <Section title="시즌">
        <DefList
          items={[
            { term: "작성시작", desc: formatDate(row.writeStartAt) },
            { term: "작성마감", desc: formatDate(row.writeEndAt) },
            { term: "결제시작", desc: formatDate(row.payStartAt) },
            { term: "결제마감", desc: formatDate(row.payEndAt) },
          ]}
        />
      </Section>

      <Divider />

      <Section title="메타">
        <DefList
          items={[
            {
              term: "source",
              desc: (
                <span className="font-mono text-xs">{row.source ?? "-"}</span>
              ),
            },
            { term: "import", desc: formatDate(row.importedAt) },
          ]}
        />
      </Section>
    </div>
  );
}
