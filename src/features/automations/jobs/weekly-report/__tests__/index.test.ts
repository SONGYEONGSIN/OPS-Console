import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const g = vi.hoisted(() => ({
  findReportFolder: vi.fn(),
  copyItemAndWait: vi.fn(),
  listWorksheetNames: vi.fn(),
  renameWorksheet: vi.fn(),
  getCellText: vi.fn(),
  setCellText: vi.fn(),
  createOrgShareLink: vi.fn(),
  sendTeamsChatMessage: vi.fn(),
  recordWeeklyRun: vi.fn(),
}));

vi.mock("../graph-ops", () => ({
  findReportFolder: g.findReportFolder,
  copyItemAndWait: g.copyItemAndWait,
  listWorksheetNames: g.listWorksheetNames,
  renameWorksheet: g.renameWorksheet,
  getCellText: g.getCellText,
  setCellText: g.setCellText,
  createOrgShareLink: g.createOrgShareLink,
}));
vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: g.sendTeamsChatMessage,
}));
vi.mock("../record", () => ({
  recordWeeklyRun: g.recordWeeklyRun,
}));

import { runWeeklyReportRollover } from "../index";

const P = "주간업무보고서_진학어플라이본부";
const ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHAREPOINT_DRIVE_ID = "drv";
  process.env.TEAMS_CHAT_ID = "19:abc@thread.v2";
  process.env.WEEKLY_REPORT_DRY_RUN = "false";
});
afterEach(() => {
  process.env = { ...ENV };
});

function folder(latestName: string, siblingNames: string[] = []) {
  return {
    folderPath: P,
    latest: {
      id: "src",
      name: latestName,
      lastModifiedDateTime: "2026-01-15T00:00:00Z",
    },
    siblings: [latestName, ...siblingNames].map((name, i) => ({
      id: `s${i}`,
      name,
      lastModifiedDateTime: "2026-01-15T00:00:00Z",
    })),
  };
}

describe("runWeeklyReportRollover", () => {
  it("SHAREPOINT_DRIVE_ID 없으면 실패", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    expect((await runWeeklyReportRollover()).ok).toBe(false);
  });

  it("폴더/파일 못 찾으면 실패", async () => {
    g.findReportFolder.mockResolvedValue(null);
    const r = await runWeeklyReportRollover();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("찾지 못");
  });

  it("드라이런 — 복제/Teams 없이 차주명·발송자만 보고", async () => {
    process.env.WEEKLY_REPORT_DRY_RUN = "true";
    g.findReportFolder.mockResolvedValue(folder(`${P}_2026_1월3주차.xlsx`));
    const r = await runWeeklyReportRollover();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("DRY-RUN");
    expect(r.message).toContain(`${P}_2026_1월4주차.xlsx`);
    expect(g.copyItemAndWait).not.toHaveBeenCalled();
    expect(g.sendTeamsChatMessage).not.toHaveBeenCalled();
    expect(g.recordWeeklyRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dry_run",
        sender: expect.any(String),
      }),
    );
  });

  it("차주 파일이 이미 있으면 skip", async () => {
    g.findReportFolder.mockResolvedValue(
      folder(`${P}_2026_1월3주차.xlsx`, [`${P}_2026_1월4주차.xlsx`]),
    );
    const r = await runWeeklyReportRollover();
    expect(r.ok).toBe(true);
    expect(r.details?.skipped).toBe(1);
    expect(g.copyItemAndWait).not.toHaveBeenCalled();
    expect(g.recordWeeklyRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped" }),
    );
  });

  it("정상 — 복제·시트 rename·셀 패치·공유링크·Teams 발송", async () => {
    g.findReportFolder.mockResolvedValue(folder(`${P}_2026_1월3주차.xlsx`));
    g.copyItemAndWait.mockResolvedValue("newid");
    g.listWorksheetNames.mockResolvedValue([
      "2026년 1월 3주차",
      "2026년 1월 2주차",
    ]);
    g.getCellText.mockResolvedValue("기간 1/12~1/16");
    g.createOrgShareLink.mockResolvedValue("https://share/x");

    const r = await runWeeklyReportRollover();
    expect(r.ok).toBe(true);
    expect(r.details?.created).toBe(1);
    expect(g.recordWeeklyRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "created",
        fileName: `${P}_2026_1월4주차.xlsx`,
        teamsSent: true,
      }),
    );
    expect(g.copyItemAndWait).toHaveBeenCalledWith(
      "drv",
      "src",
      `${P}_2026_1월4주차.xlsx`,
    );
    // 최신 시트 → 차주 시트 rename
    expect(g.renameWorksheet).toHaveBeenCalledWith(
      "drv",
      "newid",
      "2026년 1월 3주차",
      "2026년 1월 4주차",
    );
    // B2/H3 최소 2회 + (prevRange 있으면 B3) → setCell 3회
    expect(g.setCellText).toHaveBeenCalledTimes(3);
    // Teams 발송 — html에 발송자/링크 포함
    expect(g.sendTeamsChatMessage).toHaveBeenCalledTimes(1);
    const arg = g.sendTeamsChatMessage.mock.calls[0][0];
    expect(arg.chatId).toBe("19:abc@thread.v2");
    expect(arg.html).toContain("https://share/x");
    expect(arg.html).toContain("주간보고 공유드립니다");
  });
});
