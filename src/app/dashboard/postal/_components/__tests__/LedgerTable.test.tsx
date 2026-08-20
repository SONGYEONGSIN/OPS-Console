import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTable } from "../LedgerTable";
import type { LedgerLine } from "@/features/postal/ledger";

vi.mock("@/components/common/ModalShell", () => ({
  ModalShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const line = (over: Partial<LedgerLine> = {}): LedgerLine => ({
  seq: 1,
  sentOn: "2026-08-18",
  recipientOrg: "우석대학교",
  recipientName: "강정화",
  assignee: "김지현",
  confirmedBy: "박수정",
  trackingNo: "11263-1102-7080",
  note: "",
  receiptId: "r1",
  ...over,
});

/**
 * 대장이 목록이고 영수증은 증빙이다.
 *
 * 지금까지는 반대로 영수증 목록이 표를 차지했다(2026-08-20 지적). 확인해야 할 것은
 * "영수증이 어디 있나"가 아니라 **"증빙 없는 행이 있나"** 라서, 대장에 붙여 둔다.
 */
describe("LedgerTable", () => {
  it("대장 행을 그린다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{ r1: "https://s/a.jpg" }} />);
    expect(screen.getByText("우석대학교")).toBeInTheDocument();
    expect(screen.getByText("11263-1102-7080")).toBeInTheDocument();
    expect(screen.getByText("김지현")).toBeInTheDocument();
  });

  it("날짜별로 묶고 등기·영수증 수를 함께 보여준다", () => {
    render(
      <LedgerTable
        rows={[line(), line({ seq: 2, trackingNo: "…7081" })]}
        receiptUrls={{ r1: "https://s/a.jpg" }}
      />,
    );
    // 등기 2건인데 영수증은 1장 — 한 장에 여러 건이 찍히므로 정상이다
    expect(screen.getByText(/등기 2건/)).toBeInTheDocument();
    expect(screen.getByText(/영수증 1장/)).toBeInTheDocument();
  });

  it("증빙 없는 날은 드러낸다 — 이게 확인해야 할 신호다", () => {
    render(<LedgerTable rows={[line({ receiptId: null })]} receiptUrls={{}} />);
    expect(screen.getByText(/증빙 없음/)).toBeInTheDocument();
  });

  it("영수증이 있으면 눌러서 원본을 연다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{ r1: "https://s/a.jpg" }} />);
    fireEvent.click(screen.getByRole("button", { name: /영수증/ }));
    expect(screen.getByRole("img", { name: /영수증/ })).toHaveAttribute(
      "src",
      "https://s/a.jpg",
    );
  });

  it("서명이 만료돼 URL이 없으면 버튼을 만들지 않는다 — 눌러도 안 열리면 고장으로 보인다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{}} />);
    expect(screen.queryByRole("button", { name: /영수증/ })).toBeNull();
  });

  it("행이 없으면 무엇이 없는지 말한다", () => {
    render(<LedgerTable rows={[]} receiptUrls={{}} />);
    expect(screen.getByText(/대장에 기록된 발송이 없습니다/)).toBeInTheDocument();
  });
});

/**
 * 열이 날짜 묶음마다 어긋나던 것.
 *
 * 묶음마다 별도 `<table>` 을 그리면 브라우저가 표마다 열 너비를 따로 잰다. 그래서
 * 8/19 묶음의 '수신자'와 8/14 묶음의 '수신자'가 다른 자리에서 시작했다(2026-08-20 실측).
 *
 * 표 하나에 날짜를 그룹 행으로 넣으면 모든 행이 같은 열을 공유한다.
 */
describe("LedgerTable — 열 정렬", () => {
  const twoDays = [
    line(),
    line({ seq: 2, sentOn: "2026-08-14", recipientOrg: "공주대학교 천안공과대학", trackingNo: "…6941" }),
  ];

  it("표는 하나다 — 묶음마다 만들면 열 너비가 따로 계산된다", () => {
    const { container } = render(
      <LedgerTable rows={twoDays} receiptUrls={{ r1: "https://s/a.jpg" }} />,
    );
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });

  it("머리글도 한 번만 그린다", () => {
    const { container } = render(
      <LedgerTable rows={twoDays} receiptUrls={{}} />,
    );
    expect(container.querySelectorAll("thead")).toHaveLength(1);
    expect(screen.getAllByText("등기번호")).toHaveLength(1);
  });

  it("날짜는 표 안의 그룹 행으로 들어간다 — 요약도 함께", () => {
    render(<LedgerTable rows={twoDays} receiptUrls={{}} />);
    expect(screen.getByText("2026-08-18")).toBeInTheDocument();
    expect(screen.getByText("2026-08-14")).toBeInTheDocument();
    // 그룹 행이 표 밖이면 열이 다시 갈라진다
    expect(screen.getByText("2026-08-18").closest("table")).not.toBeNull();
  });
});

/**
 * 표 제목.
 *
 * 대장으로 바꾸면서 제목이 작은 글씨로 바뀌어 **없어진 것처럼 보였다**(2026-08-20 지적).
 * 이 레포의 목록 제목은 `text-xl font-bold` + 버밀리언 건수다 — 검토 대기 표가
 * 바로 위에서 그 형식을 쓰고 있어 나란히 두면 어긋남이 드러난다.
 */
describe("LedgerTable — 제목", () => {
  it("제목과 건수를 표준 형식으로 보여준다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{}} />);
    const title = screen.getByRole("heading", { name: "등기관리대장" });
    expect(title.className).toMatch(/text-xl/);
    expect(title.className).toMatch(/font-bold/);
    expect(screen.getByText("1건").className).toMatch(/text-vermilion/);
  });

  it("어느 시트를 읽었는지 함께 적는다 — 내년이면 시트가 바뀐다", () => {
    render(
      <LedgerTable rows={[line()]} receiptUrls={{}} sheetName="2026년도 우편물발송(04월~)" />,
    );
    expect(screen.getByText(/2026년도 우편물발송/)).toBeInTheDocument();
  });
});
