import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TabHeading } from "../TabHeading";

afterEach(cleanup);

describe("TabHeading", () => {
  it("h2 는 이름만, 건수는 제목 밖 muted 숫자 정렬", () => {
    render(<TabHeading title="PIMS" summary="3건" />);
    const h = screen.getByRole("heading", { name: "PIMS" });
    expect(h.tagName).toBe("H2");
    expect(h.className).toContain("text-xl");
    expect(h.className).toContain("font-bold");
    const summary = screen.getByText("3건");
    expect(h.contains(summary)).toBe(false);
    expect(summary.className).toContain("tabular-nums");
    expect(summary.className).toContain("text-muted");
  });

  it("아래 줄(children)은 제목 뒤에 온다", () => {
    render(
      <TabHeading title="PIMS" summary="3건">
        <p>보조 줄</p>
      </TabHeading>,
    );
    const h = screen.getByRole("heading", { name: "PIMS" });
    expect(
      h.compareDocumentPosition(screen.getByText("보조 줄")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
