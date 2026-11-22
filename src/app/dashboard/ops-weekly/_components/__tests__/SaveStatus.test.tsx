import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaveStatus } from "../SaveStatus";

afterEach(cleanup);

describe("SaveStatus", () => {
  it("기본은 자동 저장 안내", () => {
    render(<SaveStatus pending={false} error={null} savedAt={null} />);
    const el = screen.getByText("자동 저장");
    expect(el.className).toContain("text-muted");
    expect(el.getAttribute("aria-live")).toBe("polite");
    // 배지 — 상태 배지들과 같은 치수
    expect(el.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border", "border-line-soft", "px-1.5", "py-0.5", "text-xs"]),
    );
  });

  it("저장 중이면 오류가 남아 있어도 저장 중을 말한다", () => {
    render(<SaveStatus pending error="x" savedAt={null} />);
    expect(screen.getByText("저장 중…")).toBeInTheDocument();
  });

  it("저장 시각은 KST 24시간제", () => {
    render(
      <SaveStatus
        pending={false}
        error={null}
        savedAt="2026-11-17T05:32:00Z"
      />,
    );
    expect(screen.getByText("저장됨 14:32")).toBeInTheDocument();
  });

  it("KST 자정은 00:05 로 적는다(24:05 아님)", () => {
    render(
      <SaveStatus
        pending={false}
        error={null}
        savedAt="2026-11-16T15:05:00Z"
      />,
    );
    expect(screen.getByText("저장됨 00:05")).toBeInTheDocument();
  });

  it("실패는 vermilion 저장 안 됨", () => {
    render(
      <SaveStatus pending={false} error="x" savedAt="2026-11-17T05:32:00Z" />,
    );
    const el = screen.getByText("저장 안 됨");
    expect(el.className).toContain("text-vermilion");
    expect(el.className).toContain("border-vermilion");
  });
});
