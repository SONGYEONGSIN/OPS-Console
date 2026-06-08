import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { recordWeeklyRun } from "../record";

function mockInsert() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert }));
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from,
  });
  return { from, insert };
}

beforeEach(() => vi.clearAllMocks());

describe("recordWeeklyRun", () => {
  it("weekly_report_runs에 snake_case 행 1건 insert", async () => {
    const { from, insert } = mockInsert();
    await recordWeeklyRun({
      status: "created",
      year: 2026,
      month: 6,
      week: 2,
      fileName: "주간업무보고서_진학어플라이본부_2026_6월_2주차.xlsx",
      sender: "전성대",
      shareLink: "https://share",
      teamsSent: true,
      message: "차주 보고 생성",
    });
    expect(from).toHaveBeenCalledWith("weekly_report_runs");
    expect(insert).toHaveBeenCalledWith({
      status: "created",
      year: 2026,
      month: 6,
      week: 2,
      file_name: "주간업무보고서_진학어플라이본부_2026_6월_2주차.xlsx",
      sender: "전성대",
      share_link: "https://share",
      teams_sent: true,
      message: "차주 보고 생성",
    });
  });

  it("선택 필드 누락 시 null/false 기본값", async () => {
    const { insert } = mockInsert();
    await recordWeeklyRun({
      status: "failed",
      message: "SHAREPOINT_DRIVE_ID 미설정",
    });
    expect(insert).toHaveBeenCalledWith({
      status: "failed",
      year: null,
      month: null,
      week: null,
      file_name: null,
      sender: null,
      share_link: null,
      teams_sent: false,
      message: "SHAREPOINT_DRIVE_ID 미설정",
    });
  });

  it("적재 실패(throw)는 삼켜서 잡에 영향 없음", async () => {
    (
      createAdminClient as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error("admin client env 미설정");
    });
    await expect(
      recordWeeklyRun({ status: "skipped", message: "skip" }),
    ).resolves.toBeUndefined();
  });
});
