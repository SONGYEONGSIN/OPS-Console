import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenNoticeView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

vi.mock("@/features/open-notices/actions", () => ({
  enableOpenNoticeAutoSendAction: vi.fn(async () => ({ ok: true, message: "켬" })),
  disableOpenNoticeAutoSendAction: vi.fn(async () => ({ ok: true, message: "끔" })),
}));

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 24 * 3600_000).toISOString();

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
    writeStartAt: FUTURE,
    writeEndAt: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
    openNoticeRecipients: recipients,
    openNoticeSender: { email: "me@op.com", name: "홍길동" },
    openNoticeCanSend: true,
    ...over,
  };
}

describe("OpenNoticeView — 권한", () => {
  it("본인 담당이 아니면 폼 대신 안내", () => {
    render(<OpenNoticeView row={row({ openNoticeCanSend: false })} />);
    expect(screen.getByText(/본인이 담당한 서비스만/)).toBeInTheDocument();
    expect(screen.queryByLabelText("수신자 선택")).not.toBeInTheDocument();
  });

  it("연락처가 없으면 등록 안내", () => {
    render(<OpenNoticeView row={row({ openNoticeRecipients: [] })} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});

describe("OpenNoticeView — 자동 발송 토글", () => {
  it("서버가 지난 건이라고 하면 그 판정을 따른다", () => {
    // 날짜는 미래인데 서버가 지났다고 하는 경우 — 서버가 이긴다
    render(<OpenNoticeView row={row({ openNoticeOpenPassed: true })} />);
    expect(screen.queryByRole("button", { name: "자동 발송 켜기" })).not.toBeInTheDocument();
  });

  it("꺼져 있으면 설정 폼 + [자동 발송 켜기]", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.getByRole("button", { name: "자동 발송 켜기" })).toBeInTheDocument();
    expect(screen.getByLabelText("수신자 선택")).toBeInTheDocument();
  });

  it("발송 시각 입력란이 없다 — 서버가 오픈 시각에서 읽는다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.queryByLabelText("예약 시각")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "예약 발송" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지금 발송" })).not.toBeInTheDocument();
  });

  it("오픈 시각을 읽기 전용으로 보여준다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.getByText("오픈 시각")).toBeInTheDocument();
  });

  it("수신자를 안 고르면 켤 수 없다", () => {
    render(<OpenNoticeView row={row()} />);
    expect(screen.getByRole("button", { name: "자동 발송 켜기" })).toBeDisabled();
  });

  it("켜져 있으면 예정 시각 + [자동 발송 끄기]만 보인다", () => {
    render(
      <OpenNoticeView
        row={row({ openNoticeStatus: "scheduled", openNoticeScheduledAt: FUTURE })}
      />,
    );
    expect(screen.getByText("자동 발송 켬")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "자동 발송 끄기" })).toBeInTheDocument();
    expect(screen.queryByLabelText("수신자 선택")).not.toBeInTheDocument();
  });

  it("serviceId hidden 은 Moa 서비스ID", () => {
    const { container } = render(<OpenNoticeView row={row()} />);
    const el = container.querySelector('input[name="serviceId"]') as HTMLInputElement;
    expect(el.value).toBe("1130058");
  });
});

describe("OpenNoticeView — 경쟁률 선택", () => {
  it("기본은 체크 해제 — 본문에 경쟁률 줄이 없다", () => {
    render(<OpenNoticeView row={row()} />);
    const cb = screen.getByLabelText(/경쟁률 공개 안내 포함/) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    const body = screen.getByPlaceholderText("안내 내용을 입력하세요") as HTMLTextAreaElement;
    expect(body.value).not.toContain("addon.jinhakapply.com");
  });

  it("체크하면 본문에 경쟁률 줄이 들어간다", () => {
    render(<OpenNoticeView row={row()} />);
    fireEvent.click(screen.getByLabelText(/경쟁률 공개 안내 포함/));
    const body = screen.getByPlaceholderText("안내 내용을 입력하세요") as HTMLTextAreaElement;
    expect(body.value).toContain(
      "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio11300581.html",
    );
  });

  it("다시 해제하면 경쟁률 줄이 빠진다", () => {
    render(<OpenNoticeView row={row()} />);
    const cb = screen.getByLabelText(/경쟁률 공개 안내 포함/);
    fireEvent.click(cb);
    fireEvent.click(cb);
    const body = screen.getByPlaceholderText("안내 내용을 입력하세요") as HTMLTextAreaElement;
    expect(body.value).not.toContain("addon.jinhakapply.com");
  });
});

describe("OpenNoticeView — 지난 건", () => {
  it("오픈 시각이 지났고 안 나갔으면 켤 수 없다고 알린다", () => {
    // 지난 건 판정은 서버가 한다(렌더 중 Date.now() 금지) — 행에 실려 온다.
    render(
      <OpenNoticeView row={row({ writeStartAt: PAST, openNoticeOpenPassed: true })} />,
    );
    expect(screen.getByText(/오픈 시각.*지나 자동 발송을 켤 수 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "자동 발송 켜기" })).not.toBeInTheDocument();
  });

  it("지났고 이미 발송됐으면 발송완료를 보여준다", () => {
    render(
      <OpenNoticeView
        row={row({
          writeStartAt: PAST,
          openNoticeOpenPassed: true,
          openNoticeStatus: "sent",
          openNoticeLastSentAt: "2026-09-01T04:30:00Z",
        })}
      />,
    );
    expect(screen.getByText("발송완료")).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 13:30 발송/)).toBeInTheDocument();
  });

  it("지났지만 자동 발송이 켜져 있으면 끄기는 가능하다", () => {
    render(
      <OpenNoticeView
        row={row({
          writeStartAt: PAST,
          openNoticeOpenPassed: true,
          openNoticeStatus: "scheduled",
          openNoticeScheduledAt: PAST,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "자동 발송 끄기" })).toBeInTheDocument();
  });
});

describe("OpenNoticeView — 실패", () => {
  it("실패 이력이 있으면 다시 켜라고 알린다", () => {
    render(
      <OpenNoticeView row={row({ openNoticeLastFailedAt: "2026-09-01T04:30:00Z" })} />,
    );
    expect(screen.getByText(/발송이 실패했습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "자동 발송 켜기" })).toBeInTheDocument();
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
  });
});
