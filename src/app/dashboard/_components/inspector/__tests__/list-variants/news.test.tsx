import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { NewsView } from "../../list-variants/news/View";
import { NewsTable } from "../../list-variants/news/Table";

const baseRow: ListRow = {
  id: "news-001",
  name: "OO대학교 학사 시스템 전면 개편 발표",
  status: "active",
  owner: "system@ops.example.com",
  newsLink: "https://news.example.com/article/123",
  newsSource: "에듀프레스",
  newsPublishedAt: "2026-06-22T01:30:00.000Z",
  newsSummary: "OO대학교가 차세대 학사관리 시스템을 도입한다고 밝혔다.",
  newsKeyword: "학사 시스템",
};

describe("NewsView", () => {
  it("기사 메타 — 제목/출처/키워드 표시", () => {
    render(<NewsView row={baseRow} />);
    expect(
      screen.getByText("OO대학교 학사 시스템 전면 개편 발표"),
    ).toBeInTheDocument();
    expect(screen.getByText("에듀프레스")).toBeInTheDocument();
    expect(screen.getByText("학사 시스템")).toBeInTheDocument();
  });

  it("요약 — newsSummary 표시", () => {
    render(<NewsView row={baseRow} />);
    expect(
      screen.getByText(
        "OO대학교가 차세대 학사관리 시스템을 도입한다고 밝혔다.",
      ),
    ).toBeInTheDocument();
  });

  it("요약 없음 — 대체 문구 표시", () => {
    render(<NewsView row={{ ...baseRow, newsSummary: null }} />);
    expect(screen.getByText("요약이 없습니다.")).toBeInTheDocument();
  });

  it("원문 보기 — 새 탭 외부 링크", () => {
    render(<NewsView row={baseRow} />);
    const link = screen.getByRole("link", { name: /원문 보기/ });
    expect(link).toHaveAttribute("href", "https://news.example.com/article/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("링크 없음 — 원문 보기 버튼 미표시", () => {
    render(<NewsView row={{ ...baseRow, newsLink: undefined }} />);
    expect(
      screen.queryByRole("link", { name: /원문 보기/ }),
    ).not.toBeInTheDocument();
  });
});

describe("NewsTable", () => {
  it("열 헤더 — 출처/제목/게시일", () => {
    render(<NewsTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("출처")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("게시일")).toBeInTheDocument();
  });

  it("행 — 출처/제목 표시", () => {
    render(<NewsTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("에듀프레스")).toBeInTheDocument();
    expect(
      screen.getByText("OO대학교 학사 시스템 전면 개편 발표"),
    ).toBeInTheDocument();
  });

  it("행 클릭 — onSelect 호출", () => {
    const onSelect = vi.fn();
    render(
      <NewsTable rows={[baseRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("OO대학교 학사 시스템 전면 개편 발표"));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });

  it("빈 목록 — 안내 표시", () => {
    render(<NewsTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("수집된 뉴스 없음")).toBeInTheDocument();
  });
});
