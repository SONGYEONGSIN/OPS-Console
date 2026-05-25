import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SystemHealthPanel } from "../SystemHealthPanel";

beforeEach(() => {
  // 기본: pending fetch — 정적 3 항목만 검증하는 케이스용
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => new Promise(() => {})),
  );
});

describe("SystemHealthPanel — 7 항목 라벨", () => {
  it("7 헬스 항목 모두 라벨 렌더", () => {
    render(<SystemHealthPanel />);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("YouTube API Quota")).toBeInTheDocument();
    expect(screen.getByText("Supabase Connection")).toBeInTheDocument();
    expect(screen.getByText("Cron 자동화 엔진")).toBeInTheDocument();
    expect(screen.getByText("Microsoft Graph API")).toBeInTheDocument();
    expect(screen.getByText("SharePoint 드라이브")).toBeInTheDocument();
    expect(screen.getByText("Microsoft SSO")).toBeInTheDocument();
    expect(screen.getByText("메일 발송률 (24h)")).toBeInTheDocument();
  });

  it("SideBox border-ink 클래스 포함", () => {
    const { container } = render(<SystemHealthPanel />);
    expect((container.firstChild as HTMLElement).className).toMatch(/border-ink/);
  });
});

describe("SystemHealthPanel — 실측 3 항목 (신규)", () => {
  it("mount 시 /api/system-health 1회 fetch", () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<SystemHealthPanel />);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/system-health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fetch 전: 7 항목 모두 '측정 중…' 노출", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    render(<SystemHealthPanel />);
    // 7 항목 = Youtube/Supabase/Cron/Graph/SharePoint/SSO/Mail
    expect(screen.getAllByText(/측정 중/).length).toBeGreaterThanOrEqual(7);
  });

  it("fetch 성공 후: 7 항목 실측값 노출", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          graph: { ok: true, detail: "토큰 정상" },
          sharepoint: { ok: true, detail: "드라이브 접근 정상" },
          sso: { ok: true, detail: "Azure OAuth 활성" },
          supabase: { ok: true, detail: "48ms" },
          cron: { ok: true, detail: "3시간 전" },
          youtube: { ok: true, detail: "~700 units/day (추정)" },
          mail: { sent24h: 18, failed24h: 2, successRate: 0.9 },
        }),
      }),
    );
    render(<SystemHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText("토큰 정상")).toBeInTheDocument();
    });
    expect(screen.getByText("드라이브 접근 정상")).toBeInTheDocument();
    expect(screen.getByText("Azure OAuth 활성")).toBeInTheDocument();
    expect(screen.getByText("48ms")).toBeInTheDocument();
    expect(screen.getByText("3시간 전")).toBeInTheDocument();
    expect(screen.getByText(/700.*units/)).toBeInTheDocument();
    expect(screen.getByText(/90\.0%/)).toBeInTheDocument();
  });

  it("메일 발송 0건이면 '발송 없음'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          graph: { ok: true, detail: "ok" },
          sharepoint: { ok: true, detail: "ok" },
          sso: { ok: true, detail: "ok" },
          supabase: { ok: true, detail: "10ms" },
          cron: { ok: true, detail: "1시간 전" },
          youtube: { ok: true, detail: "ok" },
          mail: { sent24h: 0, failed24h: 0, successRate: null },
        }),
      }),
    );
    render(<SystemHealthPanel />);
    await waitFor(() => {
      expect(screen.getByText("발송 없음")).toBeInTheDocument();
    });
  });
});
