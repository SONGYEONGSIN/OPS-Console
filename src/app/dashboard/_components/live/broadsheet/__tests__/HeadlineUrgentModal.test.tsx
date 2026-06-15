import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeadlineUrgentModal } from "../HeadlineUrgentModal";

const ITEM = { label: "마감 임박", count: 18, href: "/dashboard/closing" };

describe("HeadlineUrgentModal", () => {
  it("항목 라벨과 건수를 표시한다", () => {
    render(<HeadlineUrgentModal item={ITEM} onClose={() => {}} />);
    expect(screen.getByText("마감 임박")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("'페이지 이동하기' 링크가 item.href를 가리킨다", () => {
    render(<HeadlineUrgentModal item={ITEM} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /페이지 이동하기/ });
    expect(link).toHaveAttribute("href", "/dashboard/closing");
  });

  it("sub가 있으면 표시한다", () => {
    render(
      <HeadlineUrgentModal item={ITEM} sub="대구가톨릭대 D-0" onClose={() => {}} />,
    );
    expect(screen.getByText("대구가톨릭대 D-0")).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(<HeadlineUrgentModal item={ITEM} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc 키로 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(<HeadlineUrgentModal item={ITEM} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
