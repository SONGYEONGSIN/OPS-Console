import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const sent: unknown[] = [];
const result = { ok: true as boolean, error: "" };
vi.mock("@/features/petty-cash/actions", () => ({
  appendSpend: (input: unknown) => {
    sent.push(input);
    return Promise.resolve(
      result.ok ? { ok: true } : { ok: false, error: result.error },
    );
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
// 표준 인스펙터를 그대로 쓴다 — 슬라이드인·ESC·외부 클릭 닫힘이 이미 들어 있다.
vi.mock("../../../_components/inspector/InspectorPanel", () => ({
  InspectorPanel: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => <div data-testid="inspector" data-open={open}>{children}</div>,
}));

const { SpendForm } = await import("../SpendForm");

/**
 * 전도금 사용내역 직접 추가.
 *
 * 우편물은 영수증 판독으로 자동 기록되지만, **사무용품처럼 전도금으로 사는 다른
 * 것들**은 넣을 길이 없었다(2026-08-20). 엑셀을 직접 열지 않고 넣게 한다.
 */
describe("SpendForm", () => {
  beforeEach(() => {
    sent.length = 0;
    result.ok = true;
    result.error = "";
  });

  it("입력한 대로 장부에 넘긴다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("날짜"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "사무용품" },
    });
    fireEvent.change(screen.getByLabelText("건수"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "12000" },
    });
    fireEvent.change(screen.getByLabelText("품목"), {
      target: { value: "A4용지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      date: "2026-08-20",
      title: "사무용품",
      count: 2,
      amount: 12000,
      item: "A4용지",
    });
  });

  it("금액이 없으면 보내지 않는다 — 0원짜리 줄이 장부에 남으면 안 된다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "사무용품" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(sent).toHaveLength(0);
    expect(screen.getByText("금액을 적어주세요")).toBeInTheDocument();
  });

  it("내용이 비면 보내지 않는다 — 무엇에 썼는지 없으면 장부가 아니다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(sent).toHaveLength(0);
  });

  it("실패하면 이유를 그대로 보여주고 창을 닫지 않는다", async () => {
    const onClose = vi.fn();
    result.ok = false;
    result.error = "같은 날짜·금액·건수가 이미 장부에 있습니다";
    render(<SpendForm onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByText(/이미 장부에 있습니다/)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("SpendForm — 표준 인스펙터", () => {
  it("모달이 아니라 인스펙터 패널로 연다", () => {
    render(<SpendForm onClose={() => {}} />);
    expect(screen.getByTestId("inspector")).toHaveAttribute("data-open", "true");
  });
});

/**
 * 인스펙터 안쪽도 표준을 따른다.
 *
 * 패널만 표준을 쓰고 내용은 제 나름대로 짜서 다른 메뉴와 달라 보였다(2026-08-20).
 * 표준은 `InspectorChrome` 이 정한다 — `인스펙터 · …` 라벨, 굵은 제목, 밑줄 헤더.
 * 저장/취소는 `flex-1` 로 나란히 채우고 저장이 잉크 배경이다.
 */
describe("SpendForm — 표준 인스펙터 구성", () => {
  it("인스펙터 라벨과 밑줄 헤더가 있다", () => {
    render(<SpendForm onClose={() => {}} />);
    expect(screen.getByText(/인스펙터 ·/)).toBeInTheDocument();
    const title = screen.getByRole("heading", { name: "사용내역 추가" });
    expect(title.className).toMatch(/text-xl/);
    expect(title.className).toMatch(/font-bold/);
    expect(title.closest("header")?.className).toMatch(/border-b-2/);
  });

  it("저장·취소가 표준 형태다 — 나란히 채우고 저장이 잉크 배경", () => {
    render(<SpendForm onClose={() => {}} />);
    const save = screen.getByRole("button", { name: "저장" });
    const cancel = screen.getByRole("button", { name: "취소" });
    expect(save.className).toMatch(/flex-1/);
    expect(save.className).toMatch(/bg-ink/);
    expect(cancel.className).toMatch(/flex-1/);
  });

  it("필드 라벨이 표준 크기다 — 다른 폼과 나란히 놓아도 어긋나지 않는다", () => {
    render(<SpendForm onClose={() => {}} />);
    const label = screen.getByText("내용").closest("label");
    expect(label?.className).toMatch(/text-xs/);
  });
});

/**
 * 인스펙터가 열렸을 때 본문을 가리지 않는다 + 판단에 필요한 것을 함께 보여준다.
 *
 * 패널은 `fixed` 라 그냥 열면 뒤 화면을 덮는다. `ListPattern` 은 열릴 때 본문에
 * `md:pr-[340px]` 을 줘서 비켜 놓는데, 이 탭은 그 패턴을 안 써서 처리가 없었다
 * (2026-08-20 지적).
 *
 * 내용도 입력 칸만 있어 허전했다. 다른 인스펙터처럼 **판단 재료**를 같이 둔다 —
 * 특히 최근 사용 내역은 같은 걸 두 번 넣는 실수를 서버가 거절하기 **전에** 막는다.
 */
describe("SpendForm — 내용 보강", () => {
  const RECENT = [
    { date: "2026-08-19", title: "우편물", count: 2, amount: 8340 },
    { date: "2026-08-18", title: "우편물", count: 3, amount: 13290 },
  ];

  it("현재 잔액을 보여준다", () => {
    render(<SpendForm onClose={() => {}} balance={491660} />);
    expect(screen.getByText(/491,660원/)).toBeInTheDocument();
  });

  it("금액을 넣으면 남는 금액을 미리 보여준다 — 모자라는지 넣기 전에 안다", () => {
    render(<SpendForm onClose={() => {}} balance={491660} />);
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "12000" },
    });
    expect(screen.getByText(/479,660원/)).toBeInTheDocument();
  });

  it("모자라면 드러낸다 — 숨기면 채워야 할 때를 놓친다", () => {
    render(<SpendForm onClose={() => {}} balance={1000} />);
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "5000" },
    });
    expect(screen.getByText(/잔액을 넘습니다/)).toBeInTheDocument();
  });

  it("최근 사용을 보여준다 — 같은 걸 두 번 넣는 실수를 미리 막는다", () => {
    render(<SpendForm onClose={() => {}} recent={RECENT} />);
    expect(screen.getByText(/최근 사용/)).toBeInTheDocument();
    expect(screen.getByText("2026-08-19")).toBeInTheDocument();
    expect(screen.getByText(/8,340원/)).toBeInTheDocument();
  });

  it("날짜를 비우면 오늘로 들어간다고 알린다", () => {
    render(<SpendForm onClose={() => {}} />);
    expect(screen.getByText(/비우면 오늘/)).toBeInTheDocument();
  });
});
