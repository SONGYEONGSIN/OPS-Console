import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListPattern } from "../ListPattern";
import type { ListRow } from "../ListPattern";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

/**
 * 사고보고를 작성·편집할 때만 인스펙터가 넓어지고 목록이 같이 비켜난다.
 * 텍스트가 아니라 폭 클래스까지 단언한다 — 둘이 따로 놀면 넓어진 패널이 목록을 덮는다.
 */

const incidentRows: ListRow[] = [
  {
    id: "I-001",
    name: "결제 오류",
    status: "active",
    owner: "송영신",
    incidentTitle: "결제 오류",
    incidentStatus: "처리중",
  },
];

const plainRows: ListRow[] = [
  { id: "L-001", name: "민원 접수 #1", status: "active", owner: "박지연" },
];

/** 목록 본문 래퍼 — 패딩 전환 클래스를 가진 요소. */
function gutterEls(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[class*='transition-[padding]']"),
  );
}

describe("ListPattern 인스펙터 폭 — incidents", () => {
  it("행 선택(보기 모드) → 패널 320 / 목록 여백 340", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        data={{ rows: incidentRows }}
      />,
    );
    fireEvent.click(screen.getByText("결제 오류"));
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("md:w-[320px]");
    expect(panel.className).not.toContain("md:w-[560px]");
    for (const el of gutterEls(container)) {
      expect(el.className).toContain("md:pr-[340px]");
      expect(el.className).not.toContain("md:pr-[580px]");
    }
  });

  it("행 선택 후 편집 → 패널 560 / 목록 여백 580", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        data={{ rows: incidentRows }}
      />,
    );
    fireEvent.click(screen.getByText("결제 오류"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("md:w-[560px]");
    expect(panel.className).not.toContain("md:w-[320px]");
    const els = gutterEls(container);
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) {
      expect(el.className).toContain("md:pr-[580px]");
      expect(el.className).not.toContain("md:pr-[340px]");
    }
  });

  it("+ 사고 보고(신규 작성) → 패널 560 / 목록 여백 580", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        canCreate
        createLabel="+ 사고 보고"
        data={{ rows: incidentRows }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ 사고 보고" }));
    expect(screen.getByRole("complementary").className).toContain(
      "md:w-[560px]",
    );
    for (const el of gutterEls(container)) {
      expect(el.className).toContain("md:pr-[580px]");
    }
  });

  it("편집 취소 → 다시 320 / 340", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        data={{ rows: incidentRows }}
      />,
    );
    fireEvent.click(screen.getByText("결제 오류"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("complementary").className).toContain(
      "md:w-[320px]",
    );
    for (const el of gutterEls(container)) {
      expect(el.className).toContain("md:pr-[340px]");
    }
  });

  it("readOnly 면 편집 버튼이 없어 320 / 340 그대로", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        readOnly
        data={{ rows: incidentRows }}
      />,
    );
    fireEvent.click(screen.getByText("결제 오류"));
    expect(screen.getByRole("complementary").className).toContain(
      "md:w-[320px]",
    );
    for (const el of gutterEls(container)) {
      expect(el.className).toContain("md:pr-[340px]");
    }
  });

  it("인스펙터가 닫혀 있으면 목록 여백 없음", () => {
    const { container } = render(
      <ListPattern
        title="사고보고"
        variant="incidents"
        data={{ rows: incidentRows }}
      />,
    );
    for (const el of gutterEls(container)) {
      expect(el.className).not.toMatch(/md:pr-\[/);
    }
  });
});

describe("ListPattern 인스펙터 폭 — 다른 variant 는 편집해도 그대로", () => {
  it("default variant 편집 → 320 / 340", () => {
    const { container } = render(
      <ListPattern title="민원 목록" data={{ rows: plainRows }} />,
    );
    fireEvent.click(screen.getByText("민원 접수 #1"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("md:w-[320px]");
    expect(panel.className).not.toContain("md:w-[560px]");
    const els = gutterEls(container);
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) {
      expect(el.className).toContain("md:pr-[340px]");
      expect(el.className).not.toContain("md:pr-[580px]");
    }
  });
});
