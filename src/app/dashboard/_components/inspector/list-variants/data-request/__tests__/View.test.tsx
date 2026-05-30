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
  it("발신자(본인) + 헤더 + 발송 버튼 렌더", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("heading", { name: /조선대학교/ })).toBeInTheDocument();
    expect(screen.getByText(/송영신 · me@op.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^발송$/ })).toBeInTheDocument();
  });

  it("제목 input + 본문 textarea가 기본값으로 채워져 편집 가능", () => {
    render(<DataRequestView row={row()} />);
    const subject = screen.getByPlaceholderText("제목을 입력하세요") as HTMLInputElement;
    expect(subject.value).toContain("[진학어플라이]");
    const body = screen.getByPlaceholderText("요청 내용을 입력하세요") as HTMLTextAreaElement;
    expect(body.value).toContain("[요청 항목]");
  });

  it("To 미선택이면 발송 버튼 비활성", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("button", { name: /^발송$/ })).toBeDisabled();
  });

  it("연락처 검색 시 결과 목록에 후보가 나오고 클릭하면 선택된다", () => {
    render(<DataRequestView row={row()} />);
    const search = screen.getByPlaceholderText(/연락처 검색/);
    fireEvent.change(search, { target: { value: "김" } });
    const result = screen.getByRole("button", { name: /김담당/ });
    expect(result).toBeInTheDocument();
    fireEvent.click(result);
    expect(screen.getByRole("button", { name: /^발송$/ })).toBeEnabled();
    expect(screen.getByText(/받는 사람:/)).toBeInTheDocument();
  });

  it("기본은 지금 발송 — 예약 시각 숨김, '예약 발송' 토글 클릭 시 노출", () => {
    render(<DataRequestView row={row()} />);
    // 기본(지금 발송): 예약 시각 숨김
    expect(screen.queryByLabelText("예약 시각")).toBeNull();
    // '예약 발송' 토글(이 시점엔 토글만 존재) 클릭 → 예약 시각 노출
    fireEvent.click(screen.getByRole("button", { name: "예약 발송" }));
    expect(screen.getByLabelText("예약 시각")).toBeInTheDocument();
  });
  it("예약 발송 모드 + 예약 시각 미입력이면 제출 버튼 비활성", () => {
    render(<DataRequestView row={row()} />);
    // To 선택
    fireEvent.change(screen.getByPlaceholderText(/연락처 검색/), { target: { value: "김" } });
    fireEvent.click(screen.getByRole("button", { name: /김담당/ }));
    // 예약 발송 토글로 전환
    fireEvent.click(screen.getByRole("button", { name: "예약 발송" }));
    // 제출 버튼(type=submit)은 라벨이 '예약 발송' — 예약 시각 미입력 → 비활성
    const submit = screen
      .getAllByRole("button", { name: "예약 발송" })
      .find((b) => b.getAttribute("type") === "submit");
    expect(submit).toBeDisabled();
  });

  it("취소 버튼은 선택한 수신자/예약 입력을 초기화한다", () => {
    render(<DataRequestView row={row()} />);
    // To 선택
    fireEvent.change(screen.getByPlaceholderText(/연락처 검색/), { target: { value: "김" } });
    fireEvent.click(screen.getByRole("button", { name: /김담당/ }));
    expect(screen.getByText(/받는 사람:/)).toBeInTheDocument();
    // 취소 → 초기화
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText(/받는 사람:/)).toBeNull();
    expect(screen.getByRole("button", { name: /^발송$/ })).toBeDisabled();
  });

  it("이메일 후보가 없으면 안내", () => {
    const r = { ...row(), dataRequestRecipients: [] } as ListRow;
    render(<DataRequestView row={r} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});
