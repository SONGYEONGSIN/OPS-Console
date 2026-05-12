import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoGrid } from "../VideoGrid";
import type { InsightVideoRow } from "@/features/insight-videos/schemas";

const baseRow: InsightVideoRow = {
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

const rows: InsightVideoRow[] = [
  baseRow,
  { ...baseRow, id: "11111111-2222-3333-4444-555555555555", video_id: "AAA", title: "Cursor 팁", keyword: "Cursor 사용법" },
  { ...baseRow, id: "22222222-3333-4444-5555-666666666666", video_id: "BBB", title: "Claude Code 완전 정복", keyword: "Claude Code" },
];

describe("VideoGrid", () => {
  it("rows 3개 → 카드 3개 렌더", () => {
    render(<VideoGrid videos={rows} onSelect={() => {}} />);
    expect(screen.getByText("바이브코딩 입문")).toBeInTheDocument();
    expect(screen.getByText("Cursor 팁")).toBeInTheDocument();
    expect(screen.getByText("Claude Code 완전 정복")).toBeInTheDocument();
  });

  it("빈 배열 → 안내 문구", () => {
    render(<VideoGrid videos={[]} onSelect={() => {}} />);
    expect(screen.getByText(/오늘은 신규 수집이 없습니다/)).toBeInTheDocument();
  });

  it("카드 클릭 시 onSelect(video) 호출", () => {
    const onSelect = vi.fn();
    render(<VideoGrid videos={[baseRow]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /바이브코딩 입문/ }));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });

  it("keyword chip이 렌더된다", () => {
    render(<VideoGrid videos={[baseRow]} onSelect={() => {}} />);
    expect(screen.getByText("바이브코딩")).toBeInTheDocument();
  });
});
