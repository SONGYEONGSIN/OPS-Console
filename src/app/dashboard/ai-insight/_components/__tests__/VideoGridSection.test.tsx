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

  it("13개 videos — 첫 페이지 12개 카드 노출 + 페이지 인디케이터 1/2", () => {
    const videos: InsightVideoRow[] = Array.from({ length: 13 }, (_, i) => ({
      ...video,
      id: `id-${String(i + 1).padStart(3, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      video_id: `vid${i + 1}`,
      title: `영상 ${i + 1}`,
    }));
    render(<VideoGridSection videos={videos} />);
    expect(screen.getByText("영상 1")).toBeInTheDocument();
    expect(screen.getByText("영상 12")).toBeInTheDocument();
    expect(screen.queryByText("영상 13")).not.toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it("'다음' 클릭 → 두 번째 페이지 카드 노출", () => {
    const videos: InsightVideoRow[] = Array.from({ length: 13 }, (_, i) => ({
      ...video,
      id: `id-${String(i + 1).padStart(3, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      video_id: `vid${i + 1}`,
      title: `영상 ${i + 1}`,
    }));
    render(<VideoGridSection videos={videos} />);
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByText("영상 13")).toBeInTheDocument();
    expect(screen.queryByText("영상 1")).not.toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*2/)).toBeInTheDocument();
  });

  it("12개 이하면 페이지네이션 미노출", () => {
    const videos: InsightVideoRow[] = Array.from({ length: 12 }, (_, i) => ({
      ...video,
      id: `id-${String(i + 1).padStart(3, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      video_id: `vid${i + 1}`,
      title: `영상 ${i + 1}`,
    }));
    render(<VideoGridSection videos={videos} />);
    expect(screen.queryByRole("button", { name: /다음/ })).not.toBeInTheDocument();
  });
});
