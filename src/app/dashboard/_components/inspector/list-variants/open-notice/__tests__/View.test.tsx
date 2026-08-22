import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenNoticeView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

vi.mock("@/features/open-notices/actions", () => ({
  sendOpenNoticeAction: vi.fn(async () => ({ ok: true, message: "발송되었습니다." })),
}));

const recipients = [
  {
    email: "kim@u.ac.kr",
    name: "김담당",
    department: "입학처",
    universityName: "조선대학교",
  },
];

function row(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "1130058",
    name: "2027학년도 수시모집",
    status: "active",
    owner: "",
    universityName: "조선대학교",
    serviceName: "2027학년도 수시모집",
    operatorName: "홍길동",
    serviceIdNum: 1130058,
    applicationType: "공통원서",
    writeStartAt: "2026-09-08T01:00:00Z",
    writeEndAt: "2026-09-11T09:00:00Z",
    openNoticeRecipients: recipients,
    openNoticeSender: { email: "me@op.com", name: "홍길동" },
    openNoticeCanSend: true,
    ...over,
  };
}

describe("OpenNoticeView — 권한", () => {
  it("본인 담당이 아니면 폼 대신 안내를 보여준다", () => {
    render(<OpenNoticeView row={row({ openNoticeCanSend: false })} />);
    expect(screen.getByText(/본인이 담당한 서비스만/)).toBeInTheDocument();
    expect(screen.queryByLabelText("수신자 선택")).not.toBeInTheDocument();
  });

  it("담당이면 폼이 나온다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.getByLabelText("수신자 선택")).toBeInTheDocument();
  });

  it("연락처가 없으면 등록 안내", () => {
    render(<OpenNoticeView row={row({ openNoticeRecipients: [] })} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});

describe("OpenNoticeView — 초안", () => {
  it("제목·본문 기본값이 채워진다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(
      screen.getByDisplayValue(
        "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내",
      ),
    ).toBeInTheDocument();
    const body = screen.getByPlaceholderText("안내 내용을 입력하세요") as HTMLTextAreaElement;
    expect(body.value).toContain("https://apply.jinhakapply.com/Notice/1130058/A");
    expect(body.value).toContain("2026.09.08(화) 10:00 ~ 09.11(금) 18:00");
  });

  it("serviceId hidden 은 Moa 서비스ID (row.id 가 아니다)", () => {
    const { container } = render(<OpenNoticeView row={row()} />);
    const el = container.querySelector('input[name="serviceId"]') as HTMLInputElement;
    expect(el.value).toBe("1130058");
  });
});

describe("OpenNoticeView — 중복 발송 경고", () => {
  it("발송 이력이 없으면 바로 제출 버튼", () => {
    render(<OpenNoticeView row={row()} />);
    const btn = screen.getByRole("button", { name: "발송" });
    expect(btn).toHaveAttribute("type", "submit");
    expect(screen.queryByText(/이미 발송한 서비스입니다/)).not.toBeInTheDocument();
  });

  it("이미 보낸 건은 한 번 더 눌러야 제출 버튼이 된다", () => {
    render(
      <OpenNoticeView
        row={row({ openNoticeStatus: "sent", openNoticeLastSentAt: "2026-09-01T04:30:00Z" })}
      />,
    );
    expect(screen.getByText(/이미 발송한 서비스입니다/)).toBeInTheDocument();
    const first = screen.getByRole("button", { name: "재발송 확인" });
    expect(first).toHaveAttribute("type", "button");

    fireEvent.change(screen.getByLabelText("수신자 선택"), {
      target: { value: "kim@u.ac.kr" },
    });
    fireEvent.click(first);

    const second = screen.getByRole("button", { name: "발송" });
    expect(second).toHaveAttribute("type", "submit");
  });

  it("발송완료 배지와 발송 시각을 보여준다", () => {
    render(
      <OpenNoticeView
        row={row({ openNoticeStatus: "sent", openNoticeLastSentAt: "2026-09-01T04:30:00Z" })}
      />,
    );
    expect(screen.getByText("발송완료")).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 13:30 발송/)).toBeInTheDocument();
  });
});

describe("OpenNoticeView — 발송 모드", () => {
  it("기본은 지금 발송, 예약을 고르면 시각 입력이 뜬다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.queryByLabelText("예약 시각")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "예약 발송" }));
    expect(screen.getByLabelText("예약 시각")).toBeInTheDocument();
  });

  it("수신자를 안 고르면 제출할 수 없다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.getByRole("button", { name: "발송" })).toBeDisabled();
  });
});
