import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/insight-videos/actions", () => ({
  deleteInsightVideo: vi.fn(),
}));

import { InsightInspectorBody } from "../InsightInspectorBody";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";

const baseVideo: InsightVideoRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  video_id: "dQw4w9WgXcQ",
  title: "바이브코딩 입문",
  channel_title: "vibe-codes",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  published_at: "2026-05-10T00:00:00Z",
  view_count: 1234,
  keyword: "바이브코딩",
  description: "이 영상은 바이브코딩의 핵심을 다룹니다.",
  collected_at: "2026-05-12T00:00:00Z",
};

describe("InsightInspectorBody", () => {
  it("video=null 시 아무것도 렌더하지 않음", () => {
    const { container } = render(<InsightInspectorBody video={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("iframe src가 YouTube embed URL을 포함", () => {
    render(<InsightInspectorBody video={baseVideo} />);
    const iframe = screen.getByTitle(baseVideo.title);
    expect(iframe.getAttribute("src")).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });

  it("description / 채널명 / 키워드 chip 노출", () => {
    render(<InsightInspectorBody video={baseVideo} />);
    expect(screen.getByText("이 영상은 바이브코딩의 핵심을 다룹니다.")).toBeInTheDocument();
    expect(screen.getByText("vibe-codes")).toBeInTheDocument();
    expect(screen.getByText("바이브코딩")).toBeInTheDocument();
  });

  it("YouTube 새창 링크는 noopener noreferrer", () => {
    render(<InsightInspectorBody video={baseVideo} />);
    const link = screen.getByRole("link", { name: /YouTube에서 열기/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("canDelete 미지정 시 삭제 버튼 미노출", () => {
    render(<InsightInspectorBody video={baseVideo} />);
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("canDelete=true 시 삭제 버튼 노출", () => {
    render(<InsightInspectorBody video={baseVideo} canDelete />);
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });
});
