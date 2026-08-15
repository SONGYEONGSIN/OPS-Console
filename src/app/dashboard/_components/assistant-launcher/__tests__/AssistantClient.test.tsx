import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssistantClient } from "../AssistantClient";

const { pathnameRef } = vi.hoisted(() => ({
  pathnameRef: { current: "/dashboard/incidents" },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

/** 마지막 fetch 요청 body를 꺼낸다. */
function lastRequestBody(): Record<string, unknown> {
  const mock = vi.mocked(globalThis.fetch).mock;
  const init = mock.calls[mock.calls.length - 1][1] as RequestInit;
  return JSON.parse(init.body as string);
}

function stubOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, answer: "답변", sources: [] }),
    }),
  );
}

describe("AssistantClient (chat)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("초기 — empty state + 예시 4개 + 입력창", () => {
    render(<AssistantClient />);
    expect(screen.getByLabelText("질문 입력")).toBeInTheDocument();
    expect(screen.getByText(/외국인 전형/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전송" })).toBeInTheDocument();
  });

  it("질문 입력 + 전송 → user 메시지 + assistant 답변 + 근거 표시", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          answer: "샘플 답변",
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
    const ta = screen.getByLabelText("질문 입력") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "테스트 질문" } });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      expect(screen.getByText("샘플 답변")).toBeInTheDocument();
    });
    // user 메시지
    expect(screen.getByText("테스트 질문")).toBeInTheDocument();
    // 근거
    expect(screen.getByText("테스트 사고")).toBeInTheDocument();
  });

  it("ok:false 응답 → ❌ 메시지", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: "test error" }),
      }),
    );
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      expect(screen.getByText(/test error/)).toBeInTheDocument();
    });
  });

  it("warning 포함 응답 → ⚠️ 표시", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument();
    });
  });

  it("'대화 초기화' 버튼 → 메시지 비움", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, answer: "답변", sources: [] }),
      }),
    );
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      expect(screen.getByText("답변")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "대화 초기화" }));
    expect(screen.queryByText("답변")).toBeNull();
    expect(screen.getByText(/외국인 전형/)).toBeInTheDocument();
  });

  it("multi-turn — 두 번째 질문 시 history 함께 전송", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, answer: "답변", sources: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantClient />);
    // 첫 질문
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "첫 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => expect(screen.getByText("답변")).toBeInTheDocument());
    // 두 번째 질문
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "두 번째 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      // 두 번째 호출의 body에 history (첫 질문/답변) 포함
      const lastCall = fetchMock.mock.calls[1];
      const body = JSON.parse(lastCall[1].body as string);
      expect(body.question).toBe("두 번째 질문");
      expect(body.history).toHaveLength(2);
      expect(body.history[0].content).toBe("첫 질문");
    });
  });
});

describe("AssistantClient — 현재 페이지 첨부", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("사이드바에 있는 화면이면 첨부 칩이 켜진 채로 보인다", () => {
    render(<AssistantClient />);
    expect(
      screen.getByRole("button", { name: /현재 페이지 첨부/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("켜져 있으면 질문에 pageContext를 실어 보낸다", async () => {
    stubOk();
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "이 화면 뭐야" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(lastRequestBody().pageContext).toEqual({
      path: "/dashboard/incidents",
      label: "사고보고",
      pattern: "list",
    });
  });

  it("칩을 끄면 pageContext를 보내지 않는다", async () => {
    stubOk();
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /현재 페이지 첨부/ }));
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "미수채권 얼마" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(lastRequestBody().pageContext).toBeUndefined();
  });

  it("사이드바에 없는 경로면 칩 자체를 그리지 않는다", () => {
    // 첨부할 화면 정보가 없는데 칩만 떠 있으면 켜도 아무 일이 안 일어난다.
    pathnameRef.current = "/dashboard/알수없는화면";
    render(<AssistantClient />);
    expect(screen.queryByRole("button", { name: /현재 페이지 첨부/ })).toBeNull();
  });
});

/**
 * Claude 모드 — 질문을 회사 PC 큐에 넣고 결과를 폴링한다.
 * fetch를 경로별로 갈라 응답한다(POST 적재 / GET 조회).
 */
function stubClaude(sequence: Array<Record<string, unknown>>) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (String(url).startsWith("/api/assistant/claude?")) {
        const body = sequence[Math.min(i++, sequence.length - 1)];
        return Promise.resolve({ json: async () => body });
      }
      return Promise.resolve({ json: async () => ({ ok: true, id: "req-1" }) });
    }),
  );
}

describe("AssistantClient — Claude 모드", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("모드 토글이 있고 기본은 빠른 답변이다 — 회사 PC가 꺼져도 어시스턴트는 살아 있어야 한다", () => {
    render(<AssistantClient />);
    const toggle = screen.getByRole("button", { name: /Claude로 깊게/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("Claude 모드로 보내면 큐에 적재하고 답을 폴링해 보여준다", async () => {
    stubClaude([
      { ok: true, status: "running", answer: null, sources: [] },
      {
        ok: true,
        status: "done",
        answer: "볼트에 따르면 이렇습니다",
        sources: ["개념/공문 시행번호 채번 규칙.md"],
      },
    ]);
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /Claude로 깊게/ }));
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "시행번호?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(
      () => expect(screen.getByText("볼트에 따르면 이렇습니다")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // 근거는 볼트 문서 — 눌러서 그 문서로 갈 수 있어야 한다
    expect(screen.getByText(/공문 시행번호 채번 규칙/)).toBeInTheDocument();
  });

  it("아무도 안 가져가면 회사 PC가 꺼졌다고 말한다 — 조용히 도는 것처럼 보이면 안 된다", async () => {
    stubClaude([{ ok: true, status: "pending", answer: null, sources: [] }]);
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /Claude로 깊게/ }));
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "시행번호?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(screen.getByText(/회사 PC/)).toBeInTheDocument(), {
      timeout: 20000,
    });
  }, 25000);

  it("실패하면 사유를 보여준다", async () => {
    stubClaude([
      { ok: true, status: "failed", answer: null, sources: [], message: "빈 응답" },
    ]);
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /Claude로 깊게/ }));
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => expect(screen.getByText(/빈 응답/)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});
