import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsClient } from "../SettingsClient";
import type { EnvSnapshot } from "../_env";
import type { DbSnapshot } from "../_db-shared";
import type { PollerStatus } from "@/features/system-status/queries";

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
    knowledgeFolderId: { configured: false, preview: "" },
    meetingsFolderId: { configured: false, preview: "" },
    smileediDriveId: { configured: false, preview: "" },
    smileediItemId: { configured: false, preview: "" },
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

const POLLERS_SAMPLE: PollerStatus[] = [
  {
    id: "assistant",
    label: "어시스턴트",
    table: "assistant_requests",
    thresholdMinutes: 2,
  heartbeatStaleMinutes: 5,
    hint: "회사 PC 작업 스케줄러를 확인하세요",
    verdict: "stopped",
    detail: "1건이 774분째 대기 중입니다",
    waitedMinutes: 774,
    sample: {
      pendingCount: 1,
      oldestPendingAt: "2026-08-20T21:00:00Z",
      runningCount: 0,
      oldestRunningAt: null,
      lastClaimAt: "2026-08-20T09:00:00Z",
      lastRequestAt: "2026-08-20T09:00:00Z",
    },
  },
  {
    id: "postal-extract",
    label: "우편물 판독",
    table: "postal_extract_requests",
    thresholdMinutes: 5,
  heartbeatStaleMinutes: 5,
    hint: "회사 PC의 우편물 판독 폴러를 확인하세요",
    verdict: "unknown",
    detail: "대기 중인 요청이 없어 살아 있는지 알 수 없습니다",
    waitedMinutes: null,
    sample: {
      pendingCount: 0,
      oldestPendingAt: null,
      runningCount: 0,
      oldestRunningAt: null,
      lastClaimAt: null,
      lastRequestAt: null,
    },
  },
];

/**
 * 상태 탭 — 어시스턴트가 끊겼는데 화면 어디에도 안 나오던 것이 만든 이유다.
 * 설정의 나머지 탭은 '설정값이 무엇인가'를 보여주지, '지금 되고 있나'는 안 본다.
 */
describe("SettingsClient — 상태 탭", () => {
  it("좌측 nav 첫 자리에 상태가 있다 — 고장 났을 때 먼저 여는 곳이다", () => {
    render(
      <SettingsClient title="시스템 설정" section="status" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    const navs = screen.getAllByRole("button");
    expect(navs[0]).toHaveTextContent("상태");
  });

  it("멈춘 폴러의 이름과 얼마나 밀렸는지를 보여준다", () => {
    render(
      <SettingsClient title="시스템 설정" section="status" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText("어시스턴트")).toBeInTheDocument();
    expect(screen.getByText(/774분째 대기/)).toBeInTheDocument();
  });

  it("멈췄으면 무엇을 해야 하는지 함께 보여준다 — 상태만 알려주면 소용없다", () => {
    render(
      <SettingsClient title="시스템 설정" section="status" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText(/작업 스케줄러를 확인/)).toBeInTheDocument();
  });

  it("대기가 없는 폴러는 '정상'이라 하지 않는다 — 요청이 없으면 알 수 없다", () => {
    render(
      <SettingsClient title="시스템 설정" section="status" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText(/살아 있는지 알 수 없/)).toBeInTheDocument();
    expect(screen.queryByText(/우편물 판독.*정상/)).toBeNull();
  });

  it("멈춘 것이 있으면 맨 위에서 몇 개인지 알린다", () => {
    render(
      <SettingsClient title="시스템 설정" section="status" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText(/멈춘 것으로 보이는 연결 1개/)).toBeInTheDocument();
  });
});

describe("SettingsClient — 5 섹션 (admin 시스템 운영)", () => {
  it("좌측 nav 5개 노출 (메일/외부 연동/빌드/배포/DB)", () => {
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByRole("button", { name: /메일 설정/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /외부 연동/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /빌드 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /배포 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DB 정보/ })).toBeInTheDocument();
  });

  it("page header — 메뉴명 h2", () => {
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(
      screen.getByRole("heading", { name: "시스템 설정" }),
    ).toBeInTheDocument();
  });

  it("nav 클릭 → URL ?section= replace", () => {
    replaceMock.mockClear();
    render(
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} pollers={POLLERS_SAMPLE} />,
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
      <SettingsClient title="시스템 설정" section="mail" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText("MAIL_DRY_RUN")).toBeInTheDocument();
  });

  it("integrations → SharePoint", () => {
    render(
      <SettingsClient
        title="시스템 설정"
        section="integrations"
        env={env}
        db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText("SharePoint 드라이브")).toBeInTheDocument();
  });

  it("build → 빌드 버전 + Git SHA + Node 버전", () => {
    render(
      <SettingsClient title="시스템 설정" section="build" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("v22.14.0")).toBeInTheDocument();
  });

  it("deploy → NODE_ENV + Vercel 환경", () => {
    render(
      <SettingsClient title="시스템 설정" section="deploy" env={env} db={db} pollers={POLLERS_SAMPLE} />,
    );
    expect(screen.getByText("NODE_ENV")).toBeInTheDocument();
    const productionNodes = screen.getAllByText("production");
    expect(productionNodes.length).toBeGreaterThanOrEqual(2);
  });

  it("db → 합계 + 각 테이블 count 표시 + 실패 테이블은 '집계 실패'", () => {
    render(
      <SettingsClient title="시스템 설정" section="db" env={env} db={db} pollers={POLLERS_SAMPLE} />,
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
        pollers={POLLERS_SAMPLE}
      />,
    );
    // mail 섹션엔 dry-run 플래그가 여러 개(MAIL/MATCH/WEEKLY)라 "true"가 복수 →
    // MAIL_DRY_RUN 행으로 스코프해 값 노드의 톤을 검증
    const valueNode = screen.getByText("MAIL_DRY_RUN").nextElementSibling;
    expect(valueNode?.className).toContain("text-gold");
  });
});
