import type { ViewProps } from "../types";

const STATUS_TONE = {
  미처리: "bg-washi-raised text-muted",
  처리중: "bg-vermilion/15 text-vermilion",
  처리완료: "bg-sage/15 text-sage",
  보류: "bg-washi-raised text-ink-soft",
} as const;

/** 본문 4섹션 표시 — 비어있으면 섹션 자체 생략 */
function Section({
  label,
  body,
}: {
  label: string;
  body: string | null | undefined;
}) {
  if (!body) return null;
  return (
    <section className="space-y-1.5">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="whitespace-pre-wrap rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
        {body}
      </p>
    </section>
  );
}

export function IncidentView({ row }: ViewProps) {
  const status = row.incidentStatus ?? "미처리";

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
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

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">일자</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span>
            <span className="text-muted">발생</span>{" "}
            <span>{row.incidentOccurredDate ?? "—"}</span>
          </span>
          <span>
            <span className="text-muted">처리</span>{" "}
            <span>{row.incidentResolvedDate ?? "—"}</span>
          </span>
        </div>
      </section>

      <Section label="사고경위" body={row.incidentCauseSummary} />
      <Section label="사고원인" body={row.incidentRootCause} />
      <Section label="사고처리" body={row.incidentResolution} />
      <Section label="사고대책" body={row.incidentPrevention} />

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">담당</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-muted">담당부서</span>{" "}
            <span className="text-ink">
              {row.incidentDepartment ?? "—"}
            </span>
          </span>
          <span>
            <span className="text-muted">담당자</span>{" "}
            <span className="text-ink">{row.incidentAssigneeName ?? "—"}</span>
          </span>
          <span>
            <span className="text-muted">보고자</span>{" "}
            <span className="text-ink">{row.incidentReporterName ?? "—"}</span>
          </span>
        </div>
      </section>
    </div>
  );
}
