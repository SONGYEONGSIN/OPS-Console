import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    serviceName: "수시모집",
    dataRequestSender: { email: "me@op.com", name: "송영신" },
    dataRequestLastSchedule: { start: "2025.05.11", end: "2025.06.02" },
    dataRequestRecipients: [
      { email: "kim@u.ac.kr", name: "김담당", department: "입학처", universityName: "조선대학교" },
      { email: "lee@u.ac.kr", name: "이담당", department: null, universityName: "조선대학교" },
    ],
  } as ListRow;
}

describe("DataRequestView", () => {
  it("발신자(본인) + 헤더 + 발송 버튼 + 제목 입력 렌더", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("heading", { name: /조선대학교/ })).toBeInTheDocument();
    expect(screen.getByText(/송영신 · me@op.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /발송/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/제목/)).toBeInTheDocument();
  });

  it("제목/본문이 진학어플라이 템플릿으로 미리 채워진다", () => {
    render(<DataRequestView row={row()} />);
    const subj = screen.getByPlaceholderText("제목을 입력하세요");
    expect((subj as HTMLInputElement).value).toContain("[진학어플라이]");
    const body = screen.getByPlaceholderText("요청 내용을 입력하세요");
    expect((body as HTMLTextAreaElement).value).toContain("요청 항목");
    expect((body as HTMLTextAreaElement).value).toContain("송영신");
  });

  it("To 미선택이면 발송 버튼 비활성", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("button", { name: /발송/ })).toBeDisabled();
  });

  it("연락처 검색 시 결과 목록에 후보가 나오고 클릭하면 선택된다", () => {
    render(<DataRequestView row={row()} />);
    const search = screen.getByPlaceholderText(/연락처 검색/);
    fireEvent.change(search, { target: { value: "김" } });
    const result = screen.getByRole("button", { name: /김담당/ });
    expect(result).toBeInTheDocument();
    fireEvent.click(result);
    expect(screen.getByRole("button", { name: /발송/ })).toBeEnabled();
    expect(screen.getByText(/받는 사람:/)).toBeInTheDocument();
  });

  it("이메일 후보가 없으면 안내", () => {
    const r = { ...row(), dataRequestRecipients: [] } as ListRow;
    render(<DataRequestView row={r} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});
