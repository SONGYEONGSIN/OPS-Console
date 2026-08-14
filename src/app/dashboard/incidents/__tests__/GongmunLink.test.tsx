import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GongmunLink } from "../GongmunLink";

describe("GongmunLink — 공문관리대장 바로가기", () => {
  it("url이 있으면 새 탭 링크로 그린다", () => {
    render(<GongmunLink url="https://sp.example.com/공문관리대장.xlsx" />);
    const a = screen.getByRole("link", { name: "공문관리대장" });
    expect(a).toHaveAttribute(
      "href",
      "https://sp.example.com/공문관리대장.xlsx",
    );
    expect(a).toHaveAttribute("target", "_blank");
    // 새 탭 링크는 rel 없이 두면 opener를 넘겨준다.
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("url이 null이면 아무것도 그리지 않는다", () => {
    // 조회 실패 시 깨진 링크를 누르게 하는 것보다 버튼을 감추는 편이 낫다.
    const { container } = render(<GongmunLink url={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
