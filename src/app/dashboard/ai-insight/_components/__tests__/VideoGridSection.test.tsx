import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoGridSection } from "../VideoGridSection";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";

const video: InsightVideoRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  video_id: "dQw4w9WgXcQ",
  title: "바이브코딩 입문",
  channel_title: "vibe-codes",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  published_at: "2026-05-10T00:00:00Z",
  view_count: 1234,
  keyword: "바이브코딩",
  description: "요약 텍스트",
  collected_at: "2026-05-12T00:00:00Z",
};

describe("VideoGridSection", () => {
  it("초기 렌더 — 인스펙터는 닫혀있다 (aria-hidden=true)", () => {
    render(<VideoGridSection videos={[video]} />);
    const aside = screen.getByRole("complementary", { hidden: true });
    expect(aside.getAttribute("aria-hidden")).toBe("true");
  });

  it("카드 클릭 → 인스펙터 open + iframe 노출", () => {
    render(<VideoGridSection videos={[video]} />);
    fireEvent.click(screen.getByRole("button", { name: /바이브코딩 입문/ }));
    const aside = screen.getByRole("complementary");
    expect(aside.getAttribute("aria-hidden")).toBe("false");
    const iframe = screen.getByTitle(video.title);
    expect(iframe.getAttribute("src")).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });
});
