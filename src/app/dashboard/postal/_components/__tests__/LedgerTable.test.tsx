import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTable } from "../LedgerTable";
import type { LedgerLine } from "@/features/postal/ledger";

const pushed: string[] = [];
const searchParams = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (u: string) => pushed.push(u) }),
  usePathname: () => "/dashboard/postal",
  useSearchParams: () => searchParams.current,
}));

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

  it("묶음 머리는 표 안의 그룹 행으로 들어간다 — 표 밖이면 열이 다시 갈라진다", () => {
    render(<LedgerTable rows={twoDays} receiptUrls={{}} />);
    // 같은 달이라 묶음은 하나다(월 단위).
    expect(screen.getByText("2026-08").closest("table")).not.toBeNull();
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

  it("보고 있는 연도가 드러난다 — 내년이면 시트가 바뀐다", () => {
    // 예전엔 제목 옆 회색 글씨로 시트명을 적었는데, 바꿀 수 있는 것으로 보이지
    // 않았다. 이제 눌린 연도 칩이 그 역할을 한다.
    render(
      <LedgerTable rows={[line()]} receiptUrls={{}} years={[2026, 2025]} year={2026} />,
    );
    const chip = screen.getByRole("button", { name: /2026/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.className).toMatch(/font-bold/);
  });
});

/**
 * 목록 표준 — 연도 칩 · 검색 · 월 묶음 · 페이지.
 *
 * 266행이 일자별로 갈려 화면이 끝없이 길어졌고, 연도 표기는 제목 옆 회색 글씨라
 * 바꿀 수 있는 것으로 보이지 않았다(2026-08-20 지적). 다른 목록과 같은 방식으로 맞춘다.
 */
describe("LedgerTable — 목록 표준", () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    line({
      seq: i + 1,
      sentOn: i < 5 ? "2026-08-18" : "2026-07-30",
      trackingNo: `11263-1102-70${80 + i}`,
      recipientOrg: i === 7 ? "재능대학교" : "우석대학교",
    }),
  );

  it("연도를 칩으로 고른다 — 제목 옆 회색 글씨가 아니라", () => {
    render(
      <LedgerTable
        rows={many}
        receiptUrls={{}}
        years={[2026, 2025]}
        year={2026}
      />,
    );
    expect(screen.getByRole("button", { name: /2026/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2025/ })).toBeInTheDocument();
  });

  it("고른 연도가 눌린 상태다", () => {
    render(
      <LedgerTable rows={many} receiptUrls={{}} years={[2026, 2025]} year={2026} />,
    );
    expect(screen.getByRole("button", { name: /2026/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("검색창이 있다 — 전도금 탭과 같은 자리", () => {
    render(<LedgerTable rows={many} receiptUrls={{}} />);
    expect(screen.getByLabelText("등기내역 검색")).toBeInTheDocument();
  });

  it("검색하면 걸러진다", () => {
    render(<LedgerTable rows={many} receiptUrls={{}} />);
    fireEvent.change(screen.getByLabelText("등기내역 검색"), {
      target: { value: "재능" },
    });
    expect(screen.getByText("재능대학교")).toBeInTheDocument();
    expect(screen.queryByText("우석대학교")).toBeNull();
  });

  it("월 단위로 묶는다 — 일자별로 갈리면 화면이 끝없이 길어진다", () => {
    render(<LedgerTable rows={many} receiptUrls={{}} />);
    expect(screen.getByText("2026-08")).toBeInTheDocument();
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-18")).toBeNull();
  });

  it("등기번호는 mono가 아니다 — 화면의 다른 숫자와 같은 폰트를 쓴다", () => {
    const { container } = render(<LedgerTable rows={[line()]} receiptUrls={{}} />);
    const cell = screen.getByText("11263-1102-7080");
    expect(cell.className).not.toMatch(/font-mono/);
    expect(cell.className).toMatch(/tabular-nums/);
    expect(container.querySelectorAll(".font-mono")).toHaveLength(0);
  });
});
