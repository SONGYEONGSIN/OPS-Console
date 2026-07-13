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

  it("상단 목록 이동 + 인수인계 진행 이동 링크 (상태 배지 없음)", () => {
    setup();
    expect(screen.getByRole("link", { name: /목록 이동/ })).toHaveAttribute(
      "href",
      "/dashboard/handover",
    );
    expect(
      screen.getByRole("link", { name: /인수인계 진행 이동/ }),
    ).toHaveAttribute("href", "/dashboard/handover?tab=progress");
    // 작성상태 배지는 제거됨
    expect(screen.queryByLabelText(/작성상태/)).toBeNull();
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

  it("연속 입력 → 디바운스 후 마지막 값으로 한 번만 저장", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /기타/ }));
    fireEvent.click(screen.getByRole("button", { name: /특이사항/ }));
    const textarea = screen.getByLabelText("특이사항");
    fireEvent.change(textarea, { target: { value: "첫" } });
    fireEvent.change(textarea, { target: { value: "첫둘" } });
    fireEvent.change(textarea, { target: { value: "첫둘셋" } });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    // 디바운스 + rowRef 최신값 추적 → 누적된 마지막 값으로 단 한 번만 저장.
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      service_id: "svc-1",
      notes_md: "첫둘셋",
    });
  });

  it("상단바에 대학명 · 서비스명 제목 표시", () => {
    setup();
    expect(screen.getByText(/숙명여자대학교/)).toBeInTheDocument();
    expect(screen.getByText(/Fall Admission/)).toBeInTheDocument();
  });

  it("운영가이드 레이아웃 — 카테고리 패널 헤더(제목 + 필드 구성 설명)", () => {
    setup();
    expect(screen.getByRole("heading", { name: "계약" })).toBeInTheDocument();
    expect(screen.getByText("계약정보 · 계약자료")).toBeInTheDocument();
  });

  it("복제 버튼 클릭 → 드롭다운(다른 서비스로 복제) 토글", () => {
    render(
      <HandoverEditorWorkspace
        initialRow={initialRow}
        contractsStatusOptions={[]}
        handoverServiceCandidates={[]}
        onCopyHandover={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    expect(screen.queryByText("다른 서비스로 복제")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    expect(screen.getByText("다른 서비스로 복제")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    expect(screen.queryByText("다른 서비스로 복제")).toBeNull();
  });
});
