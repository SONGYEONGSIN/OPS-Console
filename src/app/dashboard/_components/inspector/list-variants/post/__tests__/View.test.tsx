import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

function noticeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "n1",
    name: "공지 제목",
    status: "active",
    owner: "",
    slug: "NT-001",
    author: "송영신",
    meta: "2026. 06. 26.",
    ...over,
  } as ListRow;
}

describe("PostView — 공지일(post-notice)", () => {
  it("공지 일시가 있으면 작성일과 같은 형식 + 시각으로 보여준다", () => {
    render(
      <PostView
        variant="post-notice"
        row={noticeRow({ noticeAnnounceAt: "2026-08-31" })}
      />,
    );
    expect(screen.getByText("공지일")).toBeInTheDocument();
    expect(screen.getByText("2026. 08. 31. 00:00")).toBeInTheDocument();
  });

  it("공지일이 없으면 '즉시' — 스키마상 null은 즉시 공지를 뜻한다", () => {
    render(
      <PostView
        variant="post-notice"
        row={noticeRow({ noticeAnnounceAt: null })}
      />,
    );
    expect(screen.getByText("공지일")).toBeInTheDocument();
    expect(screen.getByText("즉시")).toBeInTheDocument();
  });

  it("post-feedback에는 공지일 항목이 없다", () => {
    render(
      <PostView
        variant="post-feedback"
        row={noticeRow({ noticeAnnounceAt: "2026-08-31" })}
      />,
    );
    expect(screen.queryByText("공지일")).not.toBeInTheDocument();
  });
});
