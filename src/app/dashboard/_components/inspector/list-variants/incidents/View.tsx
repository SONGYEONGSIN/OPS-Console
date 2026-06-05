"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Section, DefList, Divider, HandlingRowsBody } from "../shared";
import type { ViewProps } from "../types";
import type { ListRow } from "../../../patterns/ListPattern";
import { IncidentReportView } from "../incident-reports/View";
import { incidentReportToListRow } from "@/app/dashboard/incident-reports/_row-mapper";
import {
  getIncidentReportBundle,
  type IncidentReportBundle,
} from "@/features/incident-reports/report-bundle-action";
import { createIncidentReport } from "@/features/incident-reports/actions";
import {
  isReportLiveMirrored,
  type IncidentReportRow,
} from "@/features/incident-reports/schemas";

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
      className={`flex-1 cursor-pointer border-b-2 px-3 py-2.5 text-center text-sm font-medium ${
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
        <div className="flex items-center gap-3">
          {row.incidentUniversityName && (
            <span className="text-sm font-medium text-ink">
              {row.incidentUniversityName}
              {row.incidentServiceName && (
                <span className="ml-1.5 text-xs font-normal text-muted">
                  · {row.incidentServiceName}
                </span>
              )}
            </span>
          )}
          <span
            className={`ml-auto inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
        </div>
        {row.incidentTitle && (
          <p className="text-sm font-medium text-ink">{row.incidentTitle}</p>
        )}
        {(row.incidentYear || row.incidentAppType || row.incidentCategory) && (
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
        <HandlingRowsBody
          rows={row.incidentHandlingRows}
          fallback={row.incidentResolution}
        />
      </Section>

      <Section title="사고대책">
        <BodyText value={row.incidentPrevention} />
      </Section>
    </div>
  );
}

/** 번들 report + 서버 계산 플래그 → IncidentReportView가 읽는 ListRow로 변환.
 *  대학명(수신처)은 연결된 사고의 현재 값으로 동기화(스냅샷 staleness 방지). */
function bundleToReportRow(
  report: IncidentReportRow,
  bundle: IncidentReportBundle,
  current: {
    university?: string;
    serviceName?: string;
    title?: string;
    causeSummary?: string | null;
    rootCause?: string | null;
    handlingRows?: { time: string; content: string }[];
    prevention?: string | null;
  },
): ListRow {
  // 작성중(draft/rejected)이면 연결 사고의 현재값으로 라이브 미러, 승인 이후는 스냅샷.
  const liveMirror = isReportLiveMirrored(report.status);
  return {
    ...incidentReportToListRow(report),
    incidentReportUniversity: current.university ?? report.recipient_university,
    incidentReportServiceName:
      (liveMirror ? current.serviceName : undefined) ??
      report.service_name ??
      undefined,
    // 제목은 인스펙터 표시상 항상 연결 사고의 현재 제목을 미러(승인/발송 후에도).
    // 발송된 공문 PDF/본문은 별도로 스냅샷 유지.
    incidentReportTitle: current.title ?? report.title,
    incidentReportGyeongwi: liveMirror
      ? (current.causeSummary ?? report.gyeongwi)
      : report.gyeongwi,
    incidentReportCause: liveMirror
      ? (current.rootCause ?? report.cause)
      : report.cause,
    incidentReportPrevention: liveMirror
      ? (current.prevention ?? report.prevention)
      : report.prevention,
    incidentReportHandlingRows:
      liveMirror && current.handlingRows?.length
        ? current.handlingRows
        : report.handling_rows,
    incidentReportRecipients: bundle.recipients.map((r) => ({
      email: r.contact_email ?? "",
      name: r.customer_name,
      jobTitle: r.job_title,
    })),
    incidentReportIsApprover: bundle.isApprover,
    incidentReportCanSend: bundle.canSend,
  };
}

function ReportTab({
  incidentId,
  incidentUniversity,
  incidentContent,
}: {
  incidentId: string;
  incidentUniversity?: string;
  incidentContent?: {
    serviceName?: string;
    title?: string;
    causeSummary?: string | null;
    rootCause?: string | null;
    handlingRows?: { time: string; content: string }[];
    prevention?: string | null;
  };
}) {
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
        row={bundleToReportRow(bundle.report, bundle, {
          university: incidentUniversity,
          ...incidentContent,
        })}
        onChanged={refetch}
      />
    </div>
  );
}

export function IncidentView({ row }: ViewProps) {
  const [tab, setTab] = useState<"info" | "report">("info");

  return (
    <div className="space-y-4">
      <div className="flex border-b border-line">
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
        <ReportTab
          incidentId={row.id}
          incidentUniversity={row.incidentUniversityName}
          incidentContent={{
            serviceName: row.incidentServiceName,
            title: row.incidentTitle,
            causeSummary: row.incidentCauseSummary,
            rootCause: row.incidentRootCause,
            handlingRows: row.incidentHandlingRows,
            prevention: row.incidentPrevention,
          }}
        />
      )}
    </div>
  );
}
