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
        freezeNotice={false}
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
        freezeNotice={false}
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
        freezeNotice={false}
      />,
    );
    expect(screen.getByText("오전만")).toBeInTheDocument();
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
        freezeNotice={false}
      />,
    );
    expect(screen.getByText("11/18(수)")).toBeInTheDocument();
    expect(screen.getByText("11/18(수) ~ 11/20(금)")).toBeInTheDocument();
  });

  it("종류 라벨은 한 줄에 한 번만", () => {
    render(
      <LeaveTab
        snapshot={snap({
          leave: [
            leaveItem({
              key: "k",
              title: "연차",
              kindLabel: "연차",
              subtitle: "백업 운영자B",
            }),
          ],
        })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    const li = screen.getByText("백업 운영자B").closest("li");
    expect(li?.textContent?.match(/연차/g)).toHaveLength(1);
  });

  it("action 이 던져도 화면은 죽지 않고 행 아래에 문구를 보여 준다", async () => {
    saveItemOverride.mockRejectedValue(new Error("db down"));
    render(
      <LeaveTab
        snapshot={snap({ leave: [leaveItem()] })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    expect(
      await screen.findByText("저장하지 못했습니다 — 잠시 후 다시 시도하세요"),
    ).toBeInTheDocument();
  });
  it("탭 제목(h2)과 건수, 왼쪽에는 직접 추가 폼이 없다", () => {
    render(
      <LeaveTab
        snapshot={snap({ leave: [leaveItem()] })}
        detail={{ ...EMPTY, manual: [manualLeave()] }}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    const h = screen.getByRole("heading", { name: "휴가·외근" });
    expect(h.className).toContain("text-xl");
    expect(screen.getByText("자동 1건 · 직접 1건")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.queryByLabelText("직접 추가 제목")).toBeNull();
    expect(screen.queryByLabelText("시작일")).toBeNull();
  });
});

describe("LeaveTab — 굳는 시점 안내", () => {
  it("제출 후 최종 보고 전이면 자동 묶음 위에 굳는 시점을 알린다", () => {
    render(
      <LeaveTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r1"
        editable={false}
        freezeNotice
      />,
    );
    const note = screen.getByText("자동 항목은 최종 보고 때 굳습니다");
    const firstGroup = screen.getAllByRole("heading", { level: 3 })[0];
    expect(
      note.compareDocumentPosition(firstGroup) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it("freezeNotice 가 false 면 없다", () => {
    render(
      <LeaveTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r1"
        editable={false}
        freezeNotice={false}
      />,
    );
    expect(screen.queryByText("자동 항목은 최종 보고 때 굳습니다")).toBeNull();
  });
});
