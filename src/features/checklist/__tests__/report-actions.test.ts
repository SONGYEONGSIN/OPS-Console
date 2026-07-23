import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChecklistRound, ChecklistItem } from "../schemas";

const h = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getRoundWithItems: vi.fn(),
  execFileSync: vi.fn(),
  updateEq: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  fetchFn: vi.fn(),
}));

vi.mock("@/features/auth/permission", () => ({ requireAdmin: h.requireAdmin }));
vi.mock("../queries", () => ({ getRoundWithItems: h.getRoundWithItems }));
vi.mock("node:child_process", () => ({
  default: { execFileSync: h.execFileSync },
  execFileSync: h.execFileSync,
}));
vi.mock("node:fs", () => ({
  default: { writeFileSync: h.writeFileSync, unlinkSync: h.unlinkSync },
  writeFileSync: h.writeFileSync,
  unlinkSync: h.unlinkSync,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: (col: string, val: string) => h.updateEq(payload, col, val),
      }),
    }),
  }),
}));

import { generateChecklistReport } from "../report-actions";

const round: ChecklistRound = {
  id: "r1",
  title: "2027 수시",
  periodStart: "2026-07-27",
  periodEnd: "2026-09-11",
  status: "active",
  createdBy: "a@x.com",
  createdAt: "2026-07-20T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
};
const item: ChecklistItem = {
  id: "i1",
  roundId: "r1",
  department: "영업부",
  category: "매출",
  title: "접수건수 예측",
  status: "done",
  note: "수시 163만",
  sortOrder: 0,
  attachments: [],
};

describe("generateChecklistReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireAdmin.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", h.fetchFn);
  });

  it("회차 없으면 에러", async () => {
    h.getRoundWithItems.mockResolvedValue(null);
    const res = await generateChecklistReport("r1");
    expect(res).toEqual({ ok: false, error: "회차를 찾을 수 없습니다." });
    expect(h.execFileSync).not.toHaveBeenCalled();
  });

  it("작성 항목 없으면 claude 호출 없이 에러", async () => {
    h.getRoundWithItems.mockResolvedValue({ round, items: [] });
    const res = await generateChecklistReport("r1");
    expect(res.ok).toBe(false);
    expect(h.execFileSync).not.toHaveBeenCalled();
  });

  it("성공 시 정화된 HTML을 저장하고 ok", async () => {
    h.getRoundWithItems.mockResolvedValue({ round, items: [item] });
    // claude가 코드펜스 + 위험 속성 섞어 반환해도 정화되어 저장돼야 한다.
    h.execFileSync.mockReturnValue(
      '```html\n<h2>요약</h2><p onclick="x()">본문</p>\n```',
    );
    h.updateEq.mockReturnValue({ error: null });

    const res = await generateChecklistReport("r1");

    expect(res).toEqual({ ok: true });
    expect(h.execFileSync).toHaveBeenCalledOnce();
    const [payload] = h.updateEq.mock.calls[0];
    expect(payload.report_html).toContain("<h2>요약</h2>");
    expect(payload.report_html).toContain("본문");
    expect(payload.report_html).not.toContain("onclick"); // 정화됨
    expect(payload.report_generated_at).toBeTruthy();
  });

  it("claude 실행 실패 시 안내 에러", async () => {
    h.getRoundWithItems.mockResolvedValue({ round, items: [item] });
    h.execFileSync.mockImplementation(() => {
      throw new Error("spawn claude ENOENT");
    });
    const res = await generateChecklistReport("r1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("claude 실행 실패");
  });

  it("메모 이미지가 있으면 다운로드→프롬프트 참조→정리한다", async () => {
    const url = "https://x/storage/v1/object/public/checklist/a.jpg";
    const withImg = { ...item, note: `<img src="${url}">` };
    h.getRoundWithItems.mockResolvedValue({ round, items: [withImg] });
    h.fetchFn.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    h.execFileSync.mockReturnValue("<h2>요약</h2>");
    h.updateEq.mockReturnValue({ error: null });

    const res = await generateChecklistReport("r1");

    expect(res).toEqual({ ok: true });
    expect(h.fetchFn).toHaveBeenCalledWith(url);
    expect(h.writeFileSync).toHaveBeenCalledOnce();
    const opts = h.execFileSync.mock.calls[0][2] as { input: string };
    expect(opts.input).toContain("[첨부 이미지"); // 프롬프트에 경로 참조
    expect(h.unlinkSync).toHaveBeenCalledOnce(); // 임시파일 정리
  });
});
