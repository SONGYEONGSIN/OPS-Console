import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeadline } from "../PageHeadline";

describe("PageHeadline", () => {
  it("accent + title + dash + description 모두 렌더", () => {
    render(
      <PageHeadline
        accent="실시간"
        title="서비스 운영"
        description="현재 운영 중인 서비스 목록입니다."
      />
    );
    expect(screen.getByText("실시간")).toBeInTheDocument();
    expect(screen.getByText("서비스 운영")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("현재 운영 중인 서비스 목록입니다.")).toBeInTheDocument();
  });

  it("accent 없으면 title만 렌더 (대시 X)", () => {
    render(<PageHeadline title="자료 보관" />);
    expect(screen.getByText("자료 보관")).toBeInTheDocument();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("description 없으면 p 태그 미렌더", () => {
    const { container } = render(<PageHeadline title="자료 보관" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
