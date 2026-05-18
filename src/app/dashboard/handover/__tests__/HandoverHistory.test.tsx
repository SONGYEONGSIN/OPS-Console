import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoverHistory } from "../HandoverHistory";

vi.mock("@/features/handover/progress-actions", () => ({
  confirmHandoverProgress: vi.fn(),
  cancelHandoverProgress: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const rows = [
  {
    id: "p1",
    service_id: "s1",
    service_number: 6007001,
    university_name: "한예종",
    service_name: "KARTS",
    from_email: "from@x.com",
    from_name: "허승철",
    to_email: "me@x.com",
    to_name: "송영신",
    status: "in_progress" as const,
    notes: null,
    confirmed_at: null,
    created_at: "2026-05-17T00:00:00Z",
  },
  {
    id: "p2",
    service_id: "s2",
    service_number: 6007007,
    university_name: "한예종",
    service_name: "무용원 2차",
    from_email: "from@x.com",
    from_name: "허승철",
    to_email: "other@x.com",
    to_name: "기타",
    status: "completed" as const,
    notes: null,
    confirmed_at: "2026-05-17T01:00:00Z",
    created_at: "2026-05-17T00:00:00Z",
  },
];

describe("HandoverHistory", () => {
  it("빈 rows → '인계 이력 없음'", () => {
    render(<HandoverHistory rows={[]} meEmail="me@x.com" />);
    expect(screen.getByText("인계 이력 없음")).toBeInTheDocument();
  });

  it("rows 표시 — 서비스/인계자/인수자/상태", () => {
    render(<HandoverHistory rows={rows} meEmail="me@x.com" />);
    expect(screen.getAllByText("한예종").length).toBe(2);
    expect(screen.getAllByText("허승철").length).toBeGreaterThan(0);
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("본인이 to_email + in_progress → '확인' 버튼 노출", () => {
    render(<HandoverHistory rows={rows} meEmail="me@x.com" />);
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("본인 아닌 row → 확인 버튼 없음", () => {
    render(<HandoverHistory rows={[rows[1]]} meEmail="me@x.com" />);
    expect(screen.queryByRole("button", { name: "확인" })).toBeNull();
  });
});
