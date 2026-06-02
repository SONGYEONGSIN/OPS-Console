"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";
import type { ListRow } from "../../../patterns/ListPattern";
import { IncidentReportView } from "../incident-reports/View";
import { incidentReportToListRow } from "@/app/dashboard/incident-reports/_row-mapper";
import {
  getIncidentReportBundle,
  type IncidentReportBundle,
} from "@/features/incident-reports/report-bundle-action";
import { createIncidentReport } from "@/features/incident-reports/actions";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer border-b-2 px-3 py-1.5 text-sm font-medium ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function IncidentInfo({ row }: { row: ListRow }) {
  const status = row.incidentStatus ?? "미처리";

  return (
    <div className="space-y-6">
      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
          {row.incidentUniversityName && (
            <span className="text-sm font-medium text-ink">
              {row.incidentUniversityName}
            </span>
          )}
        </div>
        {(row.incidentYear ||
          row.incidentAppType ||
          row.incidentCategory) && (
          <p className="text-xs text-muted">
            {[
              row.incidentYear ? `${row.incidentYear}학년도` : null,
              row.incidentAppType,
              row.incidentCategory,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
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

/** 번들 report + 서버 계산 플래그 → IncidentReportView가 읽는 ListRow로 변환 */
function bundleToReportRow(
  report: IncidentReportRow,
  bundle: IncidentReportBundle,
): ListRow {
  return {
    ...incidentReportToListRow(report),
    incidentReportRecipients: bundle.recipients.map((r) => ({
      email: r.contact_email ?? "",
      name: r.customer_name,
      jobTitle: r.job_title,
    })),
    incidentReportIsApprover: bundle.isApprover,
    incidentReportCanSend: bundle.canSend,
  };
}

function ReportTab({ incidentId }: { incidentId: string }) {
  const [bundle, setBundle] = useState<IncidentReportBundle | null>(null);
  const [loading, startLoad] = useTransition();
  const [creating, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    startLoad(async () => {
      const b = await getIncidentReportBundle(incidentId);
      setBundle(b);
    });
  }, [incidentId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function onCreate() {
    setError(null);
    startCreate(async () => {
      const r = await createIncidentReport({ incident_id: incidentId });
      if (!r.ok) {
        setError(r.error ?? "경위서 작성에 실패했습니다.");
        return;
      }
      refetch();
    });
  }

  if (bundle === null) {
    return <p className="text-xs text-muted">불러오는 중…</p>;
  }

  if (bundle.report === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          이 사고에 연결된 경위서가 없습니다.
        </p>
        {error && <p className="text-xs text-vermilion">{error}</p>}
        <button
          type="button"
          disabled={creating}
          onClick={onCreate}
          className="w-full cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
        >
          {creating ? "작성 중…" : "경위서 작성"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading && <p className="text-xs text-muted">갱신 중…</p>}
      <IncidentReportView
        row={bundleToReportRow(bundle.report, bundle)}
        onChanged={refetch}
      />
    </div>
  );
}

export function IncidentView({ row }: ViewProps) {
  const [tab, setTab] = useState<"info" | "report">("info");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-line">
        <TabButton active={tab === "info"} onClick={() => setTab("info")}>
          사고정보
        </TabButton>
        <TabButton active={tab === "report"} onClick={() => setTab("report")}>
          경위서
        </TabButton>
      </div>

      {tab === "info" ? (
        <IncidentInfo row={row} />
      ) : (
        <ReportTab incidentId={row.id} />
      )}
    </div>
  );
}
