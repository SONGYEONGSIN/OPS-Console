import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockDelete = vi.fn();
const mockRefresh = vi.fn();
vi.mock("@/features/meetings/actions", () => ({
  deleteMeeting: (...args: unknown[]) => mockDelete(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

import { MeetingEditForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "m-1",
  name: "월간 운영회의",
  status: "active",
  owner: "lee@ops.test",
  meetingTitle: "월간 운영회의",
};
const noop = () => {};

describe("MeetingEditForm 삭제", () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockRefresh.mockReset();
  });

  it("편집 화면 링크는 노출하지 않고 삭제·닫기 버튼만 노출한다", () => {
    render(
      <MeetingEditForm row={row} setRow={noop} onSave={noop} onCancel={noop} />,
    );
    expect(
      screen.queryByRole("link", { name: /편집 화면 열기/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /회의록 삭제/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  it("확인 시 deleteMeeting(id) 호출 + 목록 갱신", async () => {
    mockDelete.mockResolvedValue({ ok: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onCancel = vi.fn();
    render(
      <MeetingEditForm
        row={row}
        setRow={noop}
        onSave={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /회의록 삭제/ }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("m-1"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("확인 취소 시 삭제하지 않는다", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MeetingEditForm row={row} setRow={noop} onSave={noop} onCancel={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /회의록 삭제/ }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
