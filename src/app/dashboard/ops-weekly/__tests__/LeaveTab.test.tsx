import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";

const saveItemOverride = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: (...a: unknown[]) => saveItemOverride(...a),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));

import { LeaveTab } from "../_components/LeaveTab";
import { EMPTY, leaveItem, manualLeave, snap } from "./tab-fixtures";

beforeEach(() => {
  cleanup();
  saveItemOverride.mockReset().mockResolvedValue({ ok: true });
});

describe("LeaveTab", () => {
  it("일정에만 있는 휴가에 [백업요청 만들기]", () => {
    render(
      <LeaveTab
        snapshot={snap({ leave: [leaveItem({ needsBackup: true })] })}
        detail={EMPTY}
        reportId="r"
        editable
      />,
    );
    expect(
      screen.getByRole("link", { name: "백업요청 만들기" }),
    ).toHaveAttribute("href", "/dashboard/backup");
  });

  it("휴가도 건마다 [빼기] — 그 주 보고서에만", async () => {
    render(
      <LeaveTab
        snapshot={snap({ leave: [leaveItem({ key: "leave:br:b1" })] })}
        detail={EMPTY}
        reportId="r"
        editable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    await waitFor(() =>
      expect(saveItemOverride).toHaveBeenCalledWith({
        reportId: "r",
        itemKey: "leave:br:b1",
        area: "leave",
        excluded: true,
      }),
    );
  });

  it("휴가 건 메모와 뺀 표시를 보여 주고, 직접 추가 건은 배지와 함께", () => {
    render(
      <LeaveTab
        snapshot={snap({
          leave: [leaveItem({ key: "leave:br:b1", needsBackup: true })],
        })}
        detail={{
          ...EMPTY,
          overrides: new Map([
            [
              "leave:br:b1",
              { item_key: "leave:br:b1", note: "오전만", excluded: true },
            ],
          ]),
          manual: [manualLeave({ title: "외부 교육" })],
        }}
        reportId="r"
        editable
      />,
    );
    expect(screen.getByDisplayValue("오전만")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "되살리기" }),
    ).toBeInTheDocument();
    // 뺀 행에는 백업요청 링크가 없다
    expect(screen.queryByRole("link", { name: "백업요청 만들기" })).toBeNull();
    expect(screen.getByText("외부 교육").closest("li")).toHaveTextContent(
      "직접 추가",
    );
  });

  it("기간은 하루면 하나, 여러 날이면 ~ 로 잇는다", () => {
    render(
      <LeaveTab
        snapshot={snap({
          leave: [
            leaveItem({
              key: "a",
              startYmd: "2026-11-18",
              endYmd: "2026-11-18",
            }),
            leaveItem({
              key: "b",
              startYmd: "2026-11-18",
              endYmd: "2026-11-20",
            }),
          ],
        })}
        detail={EMPTY}
        reportId="r"
        editable={false}
      />,
    );
    expect(screen.getByText("11/18(수)")).toBeInTheDocument();
    expect(screen.getByText("11/18(수) ~ 11/20(금)")).toBeInTheDocument();
  });
});
