import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

const STATUS_TONE = {
  미처리: "bg-washi-raised text-muted",
  처리중: "bg-vermilion/15 text-vermilion",
  처리완료: "bg-sage/15 text-sage",
  보류: "bg-washi-raised text-ink-soft",
} as const;

/** 본문 텍스트 블록 — 비어있으면 "—" */
function BodyText({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-muted">—</span>;
  return (
    <p className="whitespace-pre-wrap rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
      {value}
    </p>
  );
}

export function IncidentView({ row }: ViewProps) {
  const status = row.incidentStatus ?? "미처리";

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
          {row.incidentYear && (
            <span className="text-xs text-muted">{row.incidentYear}학년도</span>
          )}
          {row.incidentAppType && (
            <span className="text-xs text-muted">· {row.incidentAppType}</span>
          )}
          {row.incidentCategory && (
            <span className="text-xs text-muted">· {row.incidentCategory}</span>
          )}
        </div>
        <h2 className="text-lg font-medium text-ink">
          {row.incidentTitle ?? row.name}
        </h2>
        {row.incidentUniversityName && (
          <p className="text-xs text-ink-soft">{row.incidentUniversityName}</p>
        )}
      </section>

      <Divider />

      <Section title="일자">
        <DefList
          items={[
            { term: "발생", desc: row.incidentOccurredDate ?? "—" },
            { term: "처리", desc: row.incidentResolvedDate ?? "—" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="담당">
        <DefList
          items={[
            { term: "담당부서", desc: row.incidentDepartment ?? "—" },
            { term: "담당자", desc: row.incidentAssigneeName ?? "—" },
            { term: "보고자", desc: row.incidentReporterName ?? "—" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="사고경위">
        <BodyText value={row.incidentCauseSummary} />
      </Section>

      <Section title="사고원인">
        <BodyText value={row.incidentRootCause} />
      </Section>

      <Section title="사고처리">
        <BodyText value={row.incidentResolution} />
      </Section>

      <Section title="사고대책">
        <BodyText value={row.incidentPrevention} />
      </Section>
    </div>
  );
}
