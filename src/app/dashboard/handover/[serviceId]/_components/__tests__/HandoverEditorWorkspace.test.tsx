import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HandoverEditorWorkspace } from "../HandoverEditorWorkspace";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";

const upsertMock = vi.fn();
vi.mock("@/features/handover/actions", () => ({
  upsertHandoverRecord: (input: unknown) => upsertMock(input),
}));

const initialRow: ListRow = {
  id: "svc-1",
  name: "숙명여대 · Fall",
  status: "active",
  owner: "송영신",
  universityName: "숙명여자대학교",
  serviceName: "Fall Admission",
  handoverContractInfo: {
    title: "",
    type: "",
    progress: "",
    status: "",
    memo: "",
  },
};

function setup() {
  render(
    <HandoverEditorWorkspace
      initialRow={initialRow}
      contractsStatusOptions={[]}
      handoverServiceCandidates={[]}
      onCopyHandover={undefined}
    />,
  );
}

describe("HandoverEditorWorkspace", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ ok: true, row: { status: "draft" } });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("상단 목록 이동 링크 + 미작성 배지", () => {
    setup();
    const link = screen.getByRole("link", { name: /목록 이동/ });
    expect(link).toHaveAttribute("href", "/dashboard/handover");
    expect(screen.getByText("미작성")).toBeInTheDocument();
  });

  it("레일 클릭 → 우측 카테고리 전환", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /작업/ }));
    fireEvent.click(screen.getByRole("button", { name: /기초작업/ }));
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
  });

  it("필드 입력 → 800ms 후 upsertHandoverRecord 자동 호출", async () => {
    setup();
    // 기타 카테고리 특이사항 textarea 입력
    fireEvent.click(screen.getByRole("button", { name: /기타/ }));
    fireEvent.click(screen.getByRole("button", { name: /특이사항/ }));
    fireEvent.change(screen.getByLabelText("특이사항"), {
      target: { value: "메모입력" },
    });
    expect(screen.getByText("저장 중…")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      service_id: "svc-1",
      notes_md: "메모입력",
    });
  });
});
