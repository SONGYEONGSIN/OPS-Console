import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "../global-error";

describe("GlobalError", () => {
  it("기본 메시지 렌더", () => {
    render(
      <GlobalError
        error={new Error("test")}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByText("페이지를 불러올 수 없습니다")).toBeInTheDocument();
  });

  it("digest — error.digest 있을 때만 ERROR <digest> 표시", () => {
    const err = new Error("test") as Error & { digest?: string };
    err.digest = "abc-123";
    render(<GlobalError error={err} reset={vi.fn()} />);
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });

  it("digest 없으면 ERROR 라인 미표시", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.queryByText(/^ERROR /)).toBeNull();
  });

  it("'다시 시도' 클릭 → reset 호출", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
