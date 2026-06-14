"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { EnvSnapshot } from "./_env";
import { formatDbSnapshot, type DbSnapshot } from "./_db-shared";

export type SettingsSectionKey =
  | "mail"
  | "integrations"
  | "build"
  | "deploy"
  | "db";

type Props = {
  title: string;
  section: SettingsSectionKey;
  env: EnvSnapshot;
  db: DbSnapshot;
};

type SectionMeta = {
  key: SettingsSectionKey;
  label: string;
};

const SECTIONS: SectionMeta[] = [
  { key: "mail", label: "메일 설정" },
  { key: "integrations", label: "외부 연동" },
  { key: "build", label: "빌드 정보" },
  { key: "deploy", label: "배포 정보" },
  { key: "db", label: "DB 정보" },
];

export function SettingsClient({ title, section, env, db }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSectionChange = (next: SettingsSectionKey) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("section", next);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
      </header>
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <nav className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pb-3 max-md:pr-0">
          {SECTIONS.map((s) => {
            const active = s.key === section;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleSectionChange(s.key)}
                aria-pressed={active}
                className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
                  active
                    ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                    : "border-transparent text-ink hover:bg-line-soft"
                }`}
              >
                <span className="text-xs">{active ? "◉" : "·"}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {section === "mail" && <MailPanel env={env} />}
          {section === "integrations" && <IntegrationsPanel env={env} />}
          {section === "build" && <BuildPanel env={env} />}
          {section === "deploy" && <DeployPanel env={env} />}
          {section === "db" && <DbPanel env={env} db={db} />}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── Shared ─────────────────── */

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "muted" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "text-vermilion"
      : tone === "warn"
        ? "text-gold"
        : tone === "danger"
          ? "text-vermilion"
          : "text-ink";
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-line-soft py-2 text-sm last:border-b-0">
      <div className="text-muted">{label}</div>
      <div className={`break-all ${toneClass}`}>{value}</div>
    </div>
  );
}

function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-2">
      <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </header>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-label={ok ? "연결됨" : "미연결"}
      className={ok ? "text-vermilion" : "text-muted"}
    >
      {ok ? "● 연결됨" : "○ 미연결"}
    </span>
  );
}

/* ─────────────────── Panels ─────────────────── */

function MailPanel({ env }: { env: EnvSnapshot }) {
  return (
    <>
      <PanelHeader
        title="메일 설정"
        hint="환경 변수 기반 — 변경은 Vercel/배포 환경에서 진행합니다."
      />
      <Row
        label="MAIL_DRY_RUN"
        value={env.mail.dryRun}
        tone={env.mail.dryRun === "true" ? "warn" : "muted"}
      />
      <Row
        label="MAIL_MATCH_DRY_RUN"
        value={env.mail.matchDryRun}
        tone={env.mail.matchDryRun === "true" ? "warn" : "muted"}
      />
      <Row
        label="WEEKLY_REPORT_DRY_RUN"
        value={env.mail.weeklyReportDryRun}
        tone={env.mail.weeklyReportDryRun === "true" ? "warn" : "muted"}
      />
      <Row label="발송 임계 일수" value={env.mail.thresholdDays} tone="muted" />
      <Row label="회사명" value={env.mail.companyName} tone="muted" />
      <Row label="기본 URL" value={env.mail.baseUrl} tone="muted" />
    </>
  );
}

function IntegrationsPanel({ env }: { env: EnvSnapshot }) {
  return (
    <>
      <PanelHeader
        title="외부 연동 상태"
        hint="환경 변수 설정 여부만 표시합니다. 실 연결 검증은 후속."
      />
      <Row
        label="SharePoint 드라이브"
        value={
          <>
            <Dot ok={env.sharepoint.driveId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.driveId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 계약 시트"
        value={
          <>
            <Dot ok={env.sharepoint.contractsItemId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.contractsItemId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 미수채권 드라이브"
        value={
          <>
            <Dot ok={env.sharepoint.receivablesDriveId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.receivablesDriveId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 미수채권 시트"
        value={
          <>
            <Dot ok={env.sharepoint.receivablesItemId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.receivablesItemId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 입금내역 시트"
        value={
          <>
            <Dot ok={env.sharepoint.depositItemId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.depositItemId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 공문관리대장"
        value={
          <>
            <Dot ok={env.sharepoint.gongmunItemId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.gongmunItemId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 경위서 폴더"
        value={
          <>
            <Dot ok={env.sharepoint.incidentReportFolderId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.incidentReportFolderId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint 회의록 폴더"
        value={
          <>
            <Dot ok={env.sharepoint.meetingsFolderId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.meetingsFolderId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint SmileEDI 드라이브"
        value={
          <>
            <Dot ok={env.sharepoint.smileediDriveId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.smileediDriveId.preview}
            </span>
          </>
        }
      />
      <Row
        label="SharePoint SmileEDI 시트"
        value={
          <>
            <Dot ok={env.sharepoint.smileediItemId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.sharepoint.smileediItemId.preview}
            </span>
          </>
        }
      />
      <Row
        label="Azure AD 테넌트"
        value={
          <>
            <Dot ok={env.azure.tenantId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.azure.tenantId.preview}
            </span>
          </>
        }
      />
      <Row
        label="Azure AD 클라이언트"
        value={
          <>
            <Dot ok={env.azure.clientId.configured} />{" "}
            <span className="text-xs text-muted">
              {env.azure.clientId.preview}
            </span>
          </>
        }
      />
      <Row
        label="Azure AD 시크릿"
        value={<Dot ok={env.azure.clientSecret.configured} />}
      />
    </>
  );
}

function BuildPanel({ env }: { env: EnvSnapshot }) {
  return (
    <>
      <PanelHeader title="빌드 정보" hint="현재 실행 중인 빌드의 버전·커밋·런타임." />
      <Row label="빌드 버전" value={env.build.version} tone="muted" />
      <Row label="Git SHA" value={env.build.gitSha} tone="muted" />
      <Row label="Git Branch" value={env.build.gitBranch} tone="muted" />
      <Row label="Git Message" value={env.build.gitMessage} tone="muted" />
      <Row label="Node.js 버전" value={env.build.nodeVersion} tone="muted" />
    </>
  );
}

function DeployPanel({ env }: { env: EnvSnapshot }) {
  return (
    <>
      <PanelHeader title="배포 정보" hint="환경·리전·URL." />
      <Row
        label="NODE_ENV"
        value={env.deploy.nodeEnv}
        tone={env.deploy.nodeEnv === "production" ? "ok" : "warn"}
      />
      <Row
        label="Vercel 환경"
        value={env.deploy.vercelEnv}
        tone={env.deploy.vercelEnv === "production" ? "ok" : "muted"}
      />
      <Row label="Vercel URL" value={env.deploy.vercelUrl} tone="muted" />
      <Row label="사이트 URL" value={env.deploy.siteUrl} tone="muted" />
      <Row label="리전" value={env.deploy.region} tone="muted" />
    </>
  );
}

function DbPanel({ env, db }: { env: EnvSnapshot; db: DbSnapshot }) {
  const total = db.rows.reduce(
    (sum, r) => sum + (r.count ?? 0),
    0,
  );
  return (
    <>
      <PanelHeader
        title="DB 정보"
        hint={`Supabase 핵심 테이블 row count — ${new Date(db.fetchedAt).toLocaleString("ko-KR")} 기준`}
      />
      <Row label="Supabase URL" value={env.supabase.url} tone="muted" />
      <Row
        label="Service Role Key"
        value={<Dot ok={env.supabase.serviceRoleConfigured} />}
      />
      <Row label="합계" value={`${total.toLocaleString("ko-KR")}건`} tone="ok" />
      {db.rows.map((r) => (
        <Row
          key={r.table}
          label={`${r.label} (${r.table})`}
          value={formatDbSnapshot(r.count)}
          tone={r.count === null ? "danger" : "muted"}
        />
      ))}
    </>
  );
}
