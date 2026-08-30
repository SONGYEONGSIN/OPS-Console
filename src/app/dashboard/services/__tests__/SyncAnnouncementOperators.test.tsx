import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { syncSpy, result } = vi.hoisted(() => ({
  syncSpy: vi.fn(),
  result: {
    value: {
      ok: true,
      matched: 57,
      updated: 120,
      unmatched: ["강원과학고등학교", "건국대학교 글로컬"],
    } as unknown,
  },
}));

vi.mock("@/features/announcement-services/sync-operators", () => ({
  syncAnnouncementOperators: () => {
    syncSpy();
    return Promise.resolve(result.value);
  },
}));

const { SyncAnnouncementOperators } = await import(
  "../SyncAnnouncementOperators"
);

/**
 * 합격자발표에는 운영자 컬럼이 없어 총괄장에서 맞춰 채운다. 실측 57/87 —
 * **못 맞춘 건 반드시 보여야** 그 대학들의 성과가 사라진 걸 사람이 안다.
 */
describe("SyncAnnouncementOperators", () => {
  beforeEach(() => {
    syncSpy.mockClear();
    result.value = {
      ok: true,
      matched: 57,
      updated: 120,
      unmatched: ["강원과학고등학교", "건국대학교 글로컬"],
    };
  });

  it("누르기 전에는 돌지 않는다 — 총괄장을 매번 읽을 이유가 없다", () => {
    render(<SyncAnnouncementOperators />);
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it("누르면 총괄장에서 담당자를 맞춘다", async () => {
    render(<SyncAnnouncementOperators />);
    fireEvent.click(screen.getByRole("button", { name: /담당자 맞추기/ }));
    await waitFor(() => expect(syncSpy).toHaveBeenCalled());
  });

  it("몇 건을 맞췄는지 알린다", async () => {
    render(<SyncAnnouncementOperators />);
    fireEvent.click(screen.getByRole("button", { name: /담당자 맞추기/ }));
    expect(await screen.findByText(/57/)).toBeInTheDocument();
  });

  /**
   * 못 맞춘 대학을 안 보여주면 "다 됐다"로 읽힌다. 실제로는 그 대학들의
   * 성과가 아무에게도 안 잡힌다.
   */
  it("못 맞춘 대학을 이름으로 보여준다 — 숫자만 주면 다 된 줄 안다", async () => {
    render(<SyncAnnouncementOperators />);
    fireEvent.click(screen.getByRole("button", { name: /담당자 맞추기/ }));
    expect(await screen.findByText(/강원과학고등학교/)).toBeInTheDocument();
    expect(screen.getByText(/건국대학교 글로컬/)).toBeInTheDocument();
  });

  it("전부 맞았으면 그렇다고 말한다", async () => {
    result.value = { ok: true, matched: 87, updated: 200, unmatched: [] };
    render(<SyncAnnouncementOperators />);
    fireEvent.click(screen.getByRole("button", { name: /담당자 맞추기/ }));
    expect(await screen.findByText(/모두 맞췄습니다/)).toBeInTheDocument();
  });

  it("실패하면 사유를 그대로 보여준다", async () => {
    result.value = { ok: false, error: "총괄장을 읽지 못했습니다" };
    render(<SyncAnnouncementOperators />);
    fireEvent.click(screen.getByRole("button", { name: /담당자 맞추기/ }));
    expect(
      await screen.findByText(/총괄장을 읽지 못했습니다/),
    ).toBeInTheDocument();
  });
});
