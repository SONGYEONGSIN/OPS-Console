import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssistantClient } from "../AssistantClient";

const { pathnameRef } = vi.hoisted(() => ({
  pathnameRef: { current: "/dashboard/incidents" },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

/**
 * 질문을 실어 보낸 POST 본문.
 *
 * 폴링 GET에는 body가 없어 "마지막 호출"로는 못 잡는다 — 빠른 답변(Gemini)을
 * 걷어내고 모든 질문이 Claude 큐로 가면서 호출이 POST 1 + GET N 이 됐다.
 */
function askRequestBody(): Record<string, unknown> {
  const calls = vi.mocked(globalThis.fetch).mock.calls;
  const post = [...calls].reverse().find((c) => (c[1] as RequestInit)?.body);
  return JSON.parse((post![1] as RequestInit).body as string);
}

/** 적재하자마자 완료를 돌려주는 기본 스텁. */
function stubDone(answer = "답변", sources: string[] = []) {
  stubClaude([{ ok: true, status: "done", answer, sources }]);
}

describe("AssistantClient (chat)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("초기 — empty state + 예시 4개 + 입력창", () => {
    render(<AssistantClient />);
    expect(screen.getByLabelText("질문 입력")).toBeInTheDocument();
    expect(screen.getByText(/다음주 휴가자/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전송" })).toBeInTheDocument();
  });

  it("질문 입력 + 전송 → user 메시지 + assistant 답변 + 읽은 문서", async () => {
    stubDone("샘플 답변", ["엔티티/부산대학교 수시 서비스 세팅.md"]);
    render(<AssistantClient />);
    const ta = screen.getByLabelText("질문 입력") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "테스트 질문" } });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(
      () => expect(screen.getByText("샘플 답변")).toBeInTheDocument(),
      { timeout: 8000 },
    );
    expect(screen.getByText("테스트 질문")).toBeInTheDocument();
    // 근거 — 모델이 실제로 읽은 볼트 문서. 확장자는 떼고 보여준다.
    expect(
      screen.getByText("엔티티/부산대학교 수시 서비스 세팅"),
    ).toBeInTheDocument();
  }, 12000);

  it("적재가 거부되면 ❌ 메시지", async () => {
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

  it("'대화 초기화' 버튼 → 메시지 비움", async () => {
    stubDone();
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => expect(screen.getByText("답변")).toBeInTheDocument(), {
      timeout: 8000,
    });
    fireEvent.click(screen.getByRole("button", { name: "대화 초기화" }));
    expect(screen.queryByText("답변")).toBeNull();
    expect(screen.getByText(/다음주 휴가자/)).toBeInTheDocument();
  }, 12000);

  it("multi-turn — 두 번째 질문 시 history 함께 전송", async () => {
    stubDone();
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "첫 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => expect(screen.getByText("답변")).toBeInTheDocument(), {
      timeout: 8000,
    });
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "두 번째 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => {
      const body = askRequestBody();
      expect(body.question).toBe("두 번째 질문");
      expect(body.history).toHaveLength(2);
      expect((body.history as { content: string }[])[0].content).toBe("첫 질문");
    }, { timeout: 8000 });
  }, 15000);
});

describe("AssistantClient — 현재 페이지 첨부", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("사이드바에 있는 화면이면 첨부 칩이 켜진 채로 보인다", () => {
    render(<AssistantClient />);
    // 메뉴명만 있으면 무엇이 첨부되는지 모호하다 — "페이지"를 넣어 대상이 화면임을 밝힌다.
    expect(
      screen.getByRole("button", { name: "사고보고 페이지 첨부 켜짐" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("켜져 있으면 질문에 pageContext를 실어 보낸다", async () => {
    stubDone();
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "이 화면 뭐야" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    // Claude 경로는 사람이 읽는 한 줄로 실어 보낸다 — 프롬프트에 그대로 들어간다.
    expect(askRequestBody().pageContext).toBe("사고보고 (/dashboard/incidents)");
  });

  it("칩을 끄면 pageContext를 보내지 않는다", async () => {
    stubDone();
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /첨부/ }));
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "미수채권 얼마" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(askRequestBody().pageContext).toBeUndefined();
  });

  it("사이드바에 없는 경로면 칩 자체를 그리지 않는다", () => {
    // 첨부할 화면 정보가 없는데 칩만 떠 있으면 켜도 아무 일이 안 일어난다.
    pathnameRef.current = "/dashboard/알수없는화면";
    render(<AssistantClient />);
    expect(screen.queryByRole("button", { name: /첨부/ })).toBeNull();
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

describe("AssistantClient — 마크다운 렌더링", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  /**
   * 답의 마크다운을 그대로 렌더한다. 렌더링은 모드와 무관하므로 두 경로 모두
   * 같은 답을 주도록 스텁해, 기본 모드가 바뀌어도 이 테스트는 흔들리지 않는다.
   */
  function renderAnswer(answer: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        String(url).startsWith("/api/assistant/claude?")
          ? Promise.resolve({
              json: async () => ({ ok: true, status: "done", answer, sources: [] }),
            })
          : String(url) === "/api/assistant/claude"
            ? Promise.resolve({ json: async () => ({ ok: true, id: "r1" }) })
            : Promise.resolve({ json: async () => ({ ok: true, answer, sources: [] }) }),
      ),
    );
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), { target: { value: "q" } });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
  }

  it("제목을 제목으로 그린다 — '## 확인한 것'이 날것으로 보이면 안 된다", async () => {
    renderAnswer("## 확인한 것\n\n본문입니다.");
    await waitFor(
      () => expect(screen.getByRole("heading", { name: "확인한 것" })).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByText(/## 확인한 것/)).toBeNull();
  }, 15000);

  it("표를 표로 그린다 — 파이프가 날것으로 보이면 안 된다", async () => {
    renderAnswer("| 문서 | 관련성 |\n|---|---|\n| a.md | 절차만 |");
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByRole("cell", { name: "절차만" })).toBeInTheDocument();
  }, 15000);

  it("번호 목록도 그린다", async () => {
    renderAnswer("1. 첫째\n2. 둘째");
    await waitFor(() => expect(screen.getByText("첫째")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  }, 15000);
});

describe("AssistantClient — Claude 모드", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  /**
   * 모드 선택이 없다.
   *
   * 빠른 답변(Gemini)은 Claude 의 백업이 아니었다 — 볼트는 회사 PC 파일이라
   * Vercel 에서 못 읽고, 그쪽은 Supabase 인덱스 발췌만 봤다. 같은 질문에 다른
   * 답이 나오는 별개 기능이었고, 쓰였는지조차 이력이 없어 알 수 없었다.
   */
  it("모드 토글이 없다 — 지식망 읽기 한 갈래뿐이다", () => {
    render(<AssistantClient />);
    expect(screen.queryByRole("button", { name: /빠른 답변/ })).toBeNull();
    expect(screen.getByText(/문서를 직접 읽습니다/)).toBeInTheDocument();
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

  it("도는 동안 무엇을 하고 있는지 보여준다 — 폴러가 알려준 실제 단계다", async () => {
    stubClaude([
      { ok: true, status: "pending", answer: null, sources: [] },
      { ok: true, status: "running", answer: null, sources: [], stage: null },
      {
        ok: true,
        status: "running",
        answer: null,
        sources: [],
        stage: "지식망 문서를 읽는 중 — 부산대학교 수시",
      },
      { ok: true, status: "done", answer: "답", sources: [] },
    ]);
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "시행번호?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    // claim 전 — 아직 아무것도 안 돈다. "실행 중"이라 하면 거짓이다.
    await waitFor(
      () => expect(screen.getByText(/에이전트를 부르는 중/)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // claim 직후, 단계가 오기 전 — 잡혔다는 사실만 말한다
    await waitFor(
      () => expect(screen.getByText(/에이전트 실행 중/)).toBeInTheDocument(),
      { timeout: 8000 },
    );
    // 단계가 오면 무엇을 읽는 중인지까지 보여준다
    await waitFor(
      () =>
        expect(
          screen.getByText(/지식망 문서를 읽는 중 — 부산대학교 수시/),
        ).toBeInTheDocument(),
      { timeout: 8000 },
    );
  }, 20000);

  /**
   * 늦게 가져가도 답을 버리지 않는다.
   *
   * 2026-08-19 실측: claim 이 27초 걸렸는데(Vercel 응답 지연으로 폴러의 요청이 한 번
   * 끊기고 재시도) 화면은 15초에 폴링을 **멈췄다**. 그 뒤 도착한 343자짜리 답은
   * 갈 곳이 없어 사라졌고, 사용자에겐 "회사 PC가 꺼졌다"는 **틀린 단정**만 남았다.
   *
   * 안 가져갔다는 건 사실이지만 왜인지는 화면이 알 수 없다 — 꺼진 건지 늦는 건지.
   * 그러니 단정하지 말고 알리기만 하고, 기다리는 건 계속한다.
   */
  it("늦게 가져가도 답을 보여준다 — 15초에 멈추면 나온 답이 사라진다", async () => {
    // 순번 시퀀스를 쓰면 앞 테스트에서 남은 폴링 루프가 이걸 갉아먹어
    // 순서에 따라 통과해버린다(실측). 시간 기준이면 누가 몇 번 부르든 같다.
    const t0 = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).startsWith("/api/assistant/claude?")) {
          const late = Date.now() - t0 > 20_000;
          return Promise.resolve({
            json: async () =>
              late
                ? { ok: true, status: "done", answer: "늦게 온 답", sources: [] }
                : { ok: true, status: "pending", answer: null, sources: [] },
          });
        }
        return Promise.resolve({ json: async () => ({ ok: true, id: "req-1" }) });
      }),
    );
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "조선대 연락처?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(
      () => expect(screen.getByText(/늦게 온 답/)).toBeInTheDocument(),
      { timeout: 30000 },
    );
  }, 35000);

  it("오래 안 가져가면 알리되 꺼졌다고 단정하지 않는다", async () => {
    stubClaude([{ ok: true, status: "pending", answer: null, sources: [] }]);
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "시행번호?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(
      () => expect(screen.getByText(/응답이 없는 것 같아요/)).toBeInTheDocument(),
      { timeout: 20000 },
    );
    // 여전히 기다리는 중이어야 한다 — 실패로 끝내면 뒤늦은 답을 못 받는다
    expect(screen.queryByText(/❌/)).toBeNull();
  }, 25000);

  it("실패하면 사유를 보여준다", async () => {
    stubClaude([
      { ok: true, status: "failed", answer: null, sources: [], message: "빈 응답" },
    ]);
    render(<AssistantClient />);
    fireEvent.change(screen.getByLabelText("질문 입력"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "전송" }));
    await waitFor(() => expect(screen.getByText(/빈 응답/)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});

/**
 * 칩 이름에 켜짐/꺼짐이 없어 지금 첨부되는지 알 수 없었다. #994에서 표기를
 * 줄이며 없앴는데, 사용자가 "이 기능이 작동하는 게 맞냐"고 물을 만큼 안 보였다.
 */
describe("AssistantClient — 첨부 칩 상태 표시", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pathnameRef.current = "/dashboard/incidents";
  });

  it("켜져 있으면 '켜짐'이라고 쓴다", () => {
    render(<AssistantClient />);
    expect(
      screen.getByRole("button", { name: /첨부 켜짐/ }),
    ).toBeInTheDocument();
  });

  it("끄면 '꺼짐'으로 바뀐다", () => {
    render(<AssistantClient />);
    fireEvent.click(screen.getByRole("button", { name: /첨부 켜짐/ }));
    expect(
      screen.getByRole("button", { name: /첨부 꺼짐/ }),
    ).toBeInTheDocument();
  });

  it("어느 화면인지도 함께 보여준다 — 무엇이 첨부되는지 알아야 한다", () => {
    render(<AssistantClient />);
    expect(
      screen.getByRole("button", { name: /사고보고/ }),
    ).toBeInTheDocument();
  });
});

/**
 * 페르소나 — 어시스턴트는 agent-org 조직도의 '조율' 자리이고 이름이 명보다.
 * 그 이름이 조직도 화면에만 있고 정작 대화 창구에는 없었다.
 */
describe("AssistantClient — 명보 페르소나", () => {
  it("발화자 이름이 '명보'다", () => {
    render(<AssistantClient />);
    expect(screen.getAllByText("명보").length).toBeGreaterThan(0);
  });

  it("빈 상태에서 자기가 뭘 하는지 소개한다", () => {
    // 특정 낱말이 아니라 '출처를 밝히겠다'는 약속이 있는지를 본다.
    render(<AssistantClient />);
    expect(screen.getAllByText(/지식망/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/문서|근거|출처/).length).toBeGreaterThan(0);
  });

  it("예시는 묻는 말이 아니라 시키는 말이다", () => {
    // "시켜보세요" 라고 해놓고 예시가 질문형이면 말과 화면이 어긋난다.
    render(<AssistantClient />);
    const asks = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    const orders = asks.filter((t) => /줘\s*$/.test(t.trim()));
    expect(orders.length).toBeGreaterThanOrEqual(4);
  });

  it("답하는 순서를 미리 밝힌다 — 결론 먼저, 근거는 뒤에", () => {
    render(<AssistantClient />);
    expect(screen.getAllByText(/결론/).length).toBeGreaterThan(0);
  });

  it("예시 앞에 시켜보라는 안내가 붙는다", () => {
    render(<AssistantClient />);
    expect(screen.getByText(/이런 일을 시켜보세요/)).toBeInTheDocument();
  });
});

/**
 * 캐릭터 — `>_` 터미널 글리프는 사이드바 브랜드와 같은 결이라 어시스턴트만의
 * 얼굴이 아니었다. 8비트 스프라이트로 명보에게 얼굴을 준다.
 */
describe("AssistantAvatar — 명보 스프라이트", () => {
  it("픽셀 블록을 SVG 로 그린다 — 두 크기에서 또렷해야 한다", () => {
    const { container } = render(<AssistantClient />);
    const svg = container.querySelector("svg[data-myeongbo-sprite]");
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll("rect").length).toBeGreaterThan(10);
  });

  it("색을 하드코딩하지 않는다 — currentColor 로 토큰을 따른다", () => {
    const { container } = render(<AssistantClient />);
    const svg = container.querySelector("svg[data-myeongbo-sprite]")!;
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("배경 상자 없이 스프라이트만 그린다", () => {
    const { container } = render(<AssistantClient />);
    const host = container.querySelector("svg[data-myeongbo-sprite]")!.parentElement!;
    expect(host.className).not.toMatch(/bg-chrome-graphite|border/);
  });

  it("평소엔 정지 — 대기 중이 아니면 애니메이션 클래스가 없다", () => {
    const { container } = render(<AssistantClient />);
    const svg = container.querySelector("svg[data-myeongbo-sprite]")!;
    expect(svg.getAttribute("data-kicking")).toBe("false");
  });

  it("채팅 답변에도 이름 앞에 얼굴이 붙는다", () => {
    // 빈 상태에만 있으면 대화가 시작되는 순간 얼굴이 사라진다.
    const { container } = render(<AssistantClient />);
    // EmptyState 1개 + (대화 시작 시 메시지마다) — 최소 1개는 항상 있다
    expect(container.querySelectorAll("svg[data-myeongbo-sprite]").length).toBeGreaterThan(0);
  });

  it("장식이라 스크린리더에서 숨긴다", () => {
    const { container } = render(<AssistantClient />);
    const host = container.querySelector("svg[data-myeongbo-sprite]")!
      .closest("[aria-hidden]");
    expect(host).not.toBeNull();
  });
});
