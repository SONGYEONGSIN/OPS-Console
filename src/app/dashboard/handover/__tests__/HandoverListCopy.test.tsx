import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverListCopy } from "../HandoverListCopy";

vi.mock("@/features/handover/actions", () => ({
  copyHandoverRecord: vi.fn(async () => ({ ok: true, copiedCount: 1 })),
}));

const candidates = [
  {
    id: "svc-1",
    serviceId: 101,
    universityName: "숙명여자대학교",
    serviceName: "Fall Admission Graduate",
    hasRecord: true,
  },
  {
    id: "svc-2",
    serviceId: 102,
    universityName: "한동대학교",
    serviceName: "International Law School",
    hasRecord: false,
  },
];

describe("HandoverListCopy", () => {
  it("복제 버튼 클릭 → 원본 서비스 선택 패널 토글", () => {
    render(<HandoverListCopy candidates={candidates} />);
    expect(screen.queryByText("원본 서비스 선택")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    expect(screen.getByText("원본 서비스 선택")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    expect(screen.queryByText("원본 서비스 선택")).toBeNull();
  });

  it("원본 검색은 작성완료(hasRecord) 서비스만 노출", () => {
    render(<HandoverListCopy candidates={candidates} />);
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    fireEvent.change(screen.getByLabelText("복제 원본 서비스 검색"), {
      target: { value: "대학" },
    });
    expect(screen.getByText(/숙명여자대학교/)).toBeInTheDocument();
    expect(screen.queryByText(/한동대학교/)).toBeNull();
  });

  it("원본 선택 → 대상 선택(CopySection) 표시", () => {
    render(<HandoverListCopy candidates={candidates} />);
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    fireEvent.change(screen.getByLabelText("복제 원본 서비스 검색"), {
      target: { value: "숙명" },
    });
    fireEvent.click(screen.getByRole("button", { name: /숙명여자대학교/ }));
    expect(screen.getByLabelText("복제 대상 서비스 검색")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "원본 변경" }),
    ).toBeInTheDocument();
  });
});
