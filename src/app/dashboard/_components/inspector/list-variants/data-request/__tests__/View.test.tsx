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

  it("To 미선택이면 발송 버튼 비활성", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("button", { name: /발송/ })).toBeDisabled();
  });

  it("CC에 추가한 사람을 To로 선택하면 CC에서 제거된다", () => {
    render(<DataRequestView row={row()} />);
    // To = 김담당 선택 → CC select 노출
    const selects = screen.getAllByRole("combobox");
    const toSelect = selects[0];
    fireEvent.change(toSelect, { target: { value: "kim@u.ac.kr" } });
    // CC에 이담당 추가
    const ccSelect = screen.getAllByRole("combobox").find((s) => s !== toSelect)!;
    fireEvent.change(ccSelect, { target: { value: "lee@u.ac.kr" } });
    expect(screen.getByRole("button", { name: /이담당 참조 제거/ })).toBeInTheDocument();
    // To를 이담당으로 변경 → CC에서 이담당 제거
    fireEvent.change(toSelect, { target: { value: "lee@u.ac.kr" } });
    expect(screen.queryByRole("button", { name: /이담당 참조 제거/ })).not.toBeInTheDocument();
  });
});
