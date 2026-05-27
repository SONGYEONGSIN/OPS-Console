import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssistantClient } from "../AssistantClient";

describe("AssistantClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("초기 — 예시 4개 표시", () => {
    render(<AssistantClient />);
    expect(screen.getByText(/외국인 전형/)).toBeInTheDocument();
    expect(screen.getByLabelText("질문 입력")).toBeInTheDocument();
  });

  it("질문 입력 + 제출 → /api/assistant/ask POST + 답변 표시", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          answer: "샘플 답변입니다",
          sources: [
            {
              domain: "incident",
              id: "inc-1",
              title: "테스트 사고",
              snippet: "...",
              deepLink: "/dashboard/incidents",
            },
          ],
        }),
      }),
    );
    render(<AssistantClient />);
    const input = screen.getByLabelText("질문 입력") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "테스트 질문" } });
    fireEvent.click(screen.getByRole("button", { name: "질문" }));
    await waitFor(() => {
      expect(screen.getByText("샘플 답변입니다")).toBeInTheDocument();
    });
    expect(screen.getByText("테스트 사고")).toBeInTheDocument();
  });

  it("ok:false 응답 → 에러 메시지 표시", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: "test error" }),
      }),
    );
    render(<AssistantClient />);
    const input = screen.getByLabelText("질문 입력") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "질문" }));
    await waitFor(() => {
      expect(screen.getByText(/test error/)).toBeInTheDocument();
    });
  });

  it("warning 포함 응답 → ⚠️ 표기", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          answer: "잘 모르겠습니다",
          sources: [],
          warning: "검색 결과 없음",
        }),
      }),
    );
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "asdf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "질문" }));
    await waitFor(() => {
      expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument();
    });
  });
});
