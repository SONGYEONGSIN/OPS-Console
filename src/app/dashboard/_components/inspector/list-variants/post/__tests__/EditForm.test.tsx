import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

function baseRow(): ListRow {
  return { id: "", name: "공지 제목", status: "active", owner: "" } as ListRow;
}

describe("PostForm — 공지일(post-notice 전용)", () => {
  it("post-notice 변형이면 공지일 입력이 있다", () => {
    render(
      <PostForm
        row={baseRow()}
        variant="post-notice"
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("공지일")).toBeInTheDocument();
  });

  it("post-feedback 변형이면 공지일 입력이 없다", () => {
    render(
      <PostForm
        row={baseRow()}
        variant="post-feedback"
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("공지일")).not.toBeInTheDocument();
  });

  it("공지일 입력 시 setRow(noticeAnnounceOn) 호출", () => {
    const setRow = vi.fn();
    render(
      <PostForm
        row={baseRow()}
        variant="post-notice"
        setRow={setRow}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("공지일"), {
      target: { value: "2026-07-01" },
    });
    expect(setRow).toHaveBeenCalledWith(
      expect.objectContaining({ noticeAnnounceOn: "2026-07-01" }),
    );
  });
});
