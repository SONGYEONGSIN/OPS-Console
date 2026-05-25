import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharePointPanel } from "../SharePointPanel";

describe("SharePointPanel", () => {
  it("탭 라벨 + 안내문구 + 'SharePoint에서 열기' 링크", () => {
    render(
      <SharePointPanel
        tabLabel="업무분장"
        webUrl="https://example.sharepoint.com/x.xlsx"
        lastModified="2026-05-20T10:00:00Z"
      />,
    );
    expect(screen.getByText(/업무분장/)).toBeInTheDocument();
    expect(screen.getByText(/SharePoint/)).toBeInTheDocument();
    const link = screen.getByText(/열기/).closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://example.sharepoint.com/x.xlsx",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("lastModified 없으면 표시 생략", () => {
    render(
      <SharePointPanel
        tabLabel="가격정책"
        webUrl="https://example.sharepoint.com/x.xlsx"
        lastModified={null}
      />,
    );
    expect(screen.queryByText(/최근 수정/)).toBeNull();
  });

  it("webUrl 없으면 '메타 조회 실패' 안내", () => {
    render(
      <SharePointPanel
        tabLabel="업무분장"
        webUrl={null}
        lastModified={null}
      />,
    );
    expect(screen.getByText(/조회 실패|환경변수/)).toBeInTheDocument();
  });
});
