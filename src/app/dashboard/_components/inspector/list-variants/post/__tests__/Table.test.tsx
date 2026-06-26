import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostTable } from "../Table";
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

describe("PostTable — 팀즈 발송여부 컬럼(post-notice)", () => {
  it("post-notice면 '팀즈 발송' 헤더가 있다", () => {
    render(
      <PostTable
        variant="post-notice"
        rows={[noticeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("팀즈 발송")).toBeInTheDocument();
  });

  it("noticeSharedAt 있으면 '발송됨', 없으면 '미발송'", () => {
    render(
      <PostTable
        variant="post-notice"
        rows={[
          noticeRow({ id: "a", noticeSharedAt: "2026-06-26T02:00:00Z" }),
          noticeRow({ id: "b", noticeSharedAt: null }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송됨")).toBeInTheDocument();
    expect(screen.getByText("미발송")).toBeInTheDocument();
  });

  it("post-feedback면 '팀즈 발송' 헤더가 없다", () => {
    render(
      <PostTable
        variant="post-feedback"
        rows={[noticeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("팀즈 발송")).not.toBeInTheDocument();
  });
});
