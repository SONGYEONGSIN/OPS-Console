import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsClient } from "../SettingsClient";
import type { EnvSnapshot } from "../_env";
import type { DbSnapshot } from "../_db-shared";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard/settings",
  useSearchParams: () => new URLSearchParams(""),
}));

const env: EnvSnapshot = {
  mail: {
    dryRun: "false",
    matchDryRun: "false",
    weeklyReportDryRun: "true",
    thresholdDays: "10",
    companyName: "Folio",
    baseUrl: "https://folio.local",
  },
  sharepoint: {
    driveId: { configured: true, preview: "abc…xyz" },
    contractsItemId: { configured: true, preview: "" },
    receivablesDriveId: { configured: false, preview: "" },
    receivablesItemId: { configured: false, preview: "" },
    depositItemId: { configured: false, preview: "" },
    manualItemId: { configured: false, preview: "" },
    gongmunItemId: { configured: false, preview: "" },
    incidentReportFolderId: { configured: false, preview: "" },
  },
  azure: {
    tenantId: { configured: true, preview: "" },
    clientId: { configured: true, preview: "" },
    clientSecret: { configured: true },
  },
  supabase: { url: "https://supabase.co", serviceRoleConfigured: true },
  build: {
    version: "0.1.0",
    gitSha: "abc1234",
    gitBranch: "main",
    gitMessage: "feat: ai-tips",
    nodeVersion: "v22.14.0",
  },
  deploy: {
    nodeEnv: "production",
    vercelEnv: "production",
    vercelUrl: "folio.vercel.app",
    siteUrl: "https://folio.local",
    region: "icn1",
  },
};

const db: DbSnapshot = {
  fetchedAt: "2026-05-18T00:00:00Z",
  rows: [
    { table: "operators", label: "운영자", count: 17 },
    { table: "services", label: "서비스", count: 142 },
    { table: "missing_table", label: "실패예", count: null },
  ],
};

describe("SettingsClient — 5 섹션 (admin 시스템 운영)", () => {
  it("좌측 nav 5개 노출 (메일/외부 연동/빌드/배포/DB)", () => {
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} />,
    );
    expect(screen.getByRole("button", { name: /메일 설정/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /외부 연동/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /빌드 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /배포 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DB 정보/ })).toBeInTheDocument();
  });

  it("page header — 메뉴명 h2", () => {
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} />,
    );
    expect(
      screen.getByRole("heading", { name: "시스템 설정" }),
    ).toBeInTheDocument();
  });

  it("nav 클릭 → URL ?section= replace", () => {
    replaceMock.mockClear();
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DB 정보/ }));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("section=db"),
      expect.anything(),
    );
  });
});

describe("section 분기", () => {
  it("mail → MAIL_DRY_RUN", () => {
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} />,
    );
    expect(screen.getByText("MAIL_DRY_RUN")).toBeInTheDocument();
  });

  it("integrations → SharePoint", () => {
    render(
      <SettingsClient
        title="시스템 설정"
        section="integrations"
        env={env}
        db={db}
      />,
    );
    expect(screen.getByText("SharePoint 드라이브")).toBeInTheDocument();
  });

  it("build → 빌드 버전 + Git SHA + Node 버전", () => {
    render(
      <SettingsClient title="시스템 설정" section="build" env={env} db={db} />,
    );
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("v22.14.0")).toBeInTheDocument();
  });

  it("deploy → NODE_ENV + Vercel 환경", () => {
    render(
      <SettingsClient title="시스템 설정" section="deploy" env={env} db={db} />,
    );
    expect(screen.getByText("NODE_ENV")).toBeInTheDocument();
    const productionNodes = screen.getAllByText("production");
    expect(productionNodes.length).toBeGreaterThanOrEqual(2);
  });

  it("db → 합계 + 각 테이블 count 표시 + 실패 테이블은 '집계 실패'", () => {
    render(
      <SettingsClient title="시스템 설정" section="db" env={env} db={db} />,
    );
    expect(screen.getByText(/합계/)).toBeInTheDocument();
    expect(screen.getByText(/운영자.*operators/)).toBeInTheDocument();
    expect(screen.getByText("17건")).toBeInTheDocument();
    expect(screen.getByText("142건")).toBeInTheDocument();
    expect(screen.getByText("집계 실패")).toBeInTheDocument();
  });
});

describe("MAIL_DRY_RUN 톤", () => {
  it("dryRun=true → 경고 톤", () => {
    render(
      <SettingsClient
        title="시스템 설정"
        section="mail"
        env={{ ...env, mail: { ...env.mail, dryRun: "true" } }}
        db={db}
      />,
    );
    const node = screen.getByText("true");
    expect(node.className).toContain("text-gold");
  });
});
