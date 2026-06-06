import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkifiedText } from "../LinkifiedText";

describe("LinkifiedText", () => {
  it("URL은 새 탭 링크로 렌더", () => {
    render(
      <LinkifiedText text="자료: https://jinhaksa.sharepoint.com/x?e=aiTLyI 확인" />,
    );
    const link = screen.getByRole("link", {
      name: "https://jinhaksa.sharepoint.com/x?e=aiTLyI",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://jinhaksa.sharepoint.com/x?e=aiTLyI",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("URL 없는 텍스트는 링크 없이 그대로", () => {
    render(<LinkifiedText text="그냥 메모" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("그냥 메모")).toBeInTheDocument();
  });

  it("여러 URL + 줄바꿈 보존", () => {
    render(<LinkifiedText text={"a http://x.com\nb https://y.com"} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
