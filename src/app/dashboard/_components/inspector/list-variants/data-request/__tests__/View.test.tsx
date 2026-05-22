import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataRequestView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

vi.mock("@/features/data-requests/actions", () => ({
  sendDataRequestAction: vi.fn(async () => ({ ok: true, message: "발송되었습니다." })),
}));

function row(): ListRow {
  return {
    id: "s1",
    name: "원서접수",
    status: "active",
    owner: "",
    universityName: "조선대학교",
    serviceName: "원서접수",
    dataRequestRecipients: [
      { email: "kim@u.ac.kr", name: "김담당", department: "입학처", universityName: "조선대학교" },
      { email: "lee@u.ac.kr", name: "이담당", department: null, universityName: "조선대학교" },
    ],
  } as ListRow;
}

describe("DataRequestView", () => {
  it("서비스 헤더 + 발송 버튼 + 제목 입력 렌더", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByText(/조선대학교/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /발송/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/제목/)).toBeInTheDocument();
  });
  it("수신자 후보(연락처)가 옵션으로 노출", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByText(/김담당/)).toBeInTheDocument();
  });
  it("이메일 후보가 없으면 안내", () => {
    const r = { ...row(), dataRequestRecipients: [] } as ListRow;
    render(<DataRequestView row={r} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});
