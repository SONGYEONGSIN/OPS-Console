import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  promoteCandidateAction,
  hideCandidateAction,
  unhideCandidateAction,
} from "@/features/ai-tip-candidates/actions";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiTipCandidateView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "클로드 코드로 반복 작업 줄이기",
  status: "active",
  owner: "",
  summary: "터미널에서 바로 코드를 고친다.",
  reusePrompt: "이 리포를 우리 업무에 적용할 방법을 정리해줘.",
  tags: ["반복작업", "에이전트"],
  aiTool: "claude",
  category: "automation",
  tipCandidateStatus: "pending",
  tipCandidateRepoFullName: "anthropics/claude-code",
  tipCandidateRepoUrl: "https://github.com/anthropics/claude-code",
  tipCandidateRepoDescription: "터미널에서 도는 코딩 에이전트",
  tipCandidateStars: 1234,
  // KST 로 9/1 09:30 — UTC 그대로 찍으면 8/31 로 하루 밀린다.
  tipCandidateCollectedAt: "2026-09-01T00:30:00.000Z",
  tipCandidateCanDecide: true,
};

/** 백필된 행 — 리포 메타를 물어봐서 받은 상태. */
const syncedRow: ListRow = {
  ...baseRow,
  tipCandidateRepoLanguage: "TypeScript",
  // KST 로 9/5 — UTC 그대로 찍으면 9/4 로 하루 밀린다.
  tipCandidateRepoPushedAt: "2026-09-04T20:30:00.000Z",
  tipCandidateRepoSyncedAt: "2026-09-12T00:30:00.000Z",
};

describe("AiTipCandidateView — 상세", () => {
  it("초안 요약과 재사용 프롬프트를 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("터미널에서 바로 코드를 고친다.")).toBeInTheDocument();
    expect(
      screen.getByText("이 리포를 우리 업무에 적용할 방법을 정리해줘."),
    ).toBeInTheDocument();
  });

  it("태그를 모두 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("반복작업")).toBeInTheDocument();
    expect(screen.getByText("에이전트")).toBeInTheDocument();
  });

  it("AI 도구·카테고리를 라벨로 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("자동화")).toBeInTheDocument();
  });

  it("리포 설명을 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("터미널에서 도는 코딩 에이전트")).toBeInTheDocument();
  });

  it("별은 수집 시점 값이라고 함께 적는다 — 라벨이 없으면 지금 별로 읽힌다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/1,?234/)).toBeInTheDocument();
    expect(screen.getByText(/수집 시점/)).toBeInTheDocument();
  });

  it("수집일은 KST 로 찍는다 — UTC 그대로면 하루 밀린다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/2026\D+09\D+01/)).toBeInTheDocument();
  });

  it("'레포로 이동' 은 새 탭으로 열고 호버는 검정 배경이다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    const link = screen.getByRole("link", { name: /레포로 이동/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/anthropics/claude-code",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link.className).toContain("hover:bg-ink");
    expect(link.className).toContain("hover:text-cream");
  });

  it("초안이 없으면 없다고 말한다 — 빈칸이면 왜 비었는지 모른다", () => {
    render(
      <AiTipCandidateView
        row={{
          ...baseRow,
          summary: "",
          reusePrompt: null,
          tags: [],
          aiTool: undefined,
          category: undefined,
        }}
      />,
    );
    // 비는 자리는 넷이다 — 요약·프롬프트·AI 도구·카테고리.
    expect(screen.getAllByText(/초안 없음/)).toHaveLength(4);
  });

  it("언어·최근 업데이트를 항목으로 보여준다", () => {
    render(<AiTipCandidateView row={syncedRow} />);
    expect(screen.getByText("언어")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("최근 업데이트")).toBeInTheDocument();
    expect(screen.getByText(/2026\D+09\D+05/)).toBeInTheDocument();
  });

  it("주 언어가 없는 리포는 '없음' — 대시로 두면 못 받은 것으로 읽힌다", () => {
    render(
      <AiTipCandidateView
        row={{ ...syncedRow, tipCandidateRepoLanguage: null }}
      />,
    );
    expect(screen.getByText("없음")).toBeInTheDocument();
  });

  it("조회시각이 있으면 별·언어·최근 업데이트를 한 줄로 묶는다 — 라벨 셋은 노이즈다", () => {
    const { container } = render(<AiTipCandidateView row={syncedRow} />);
    const line = screen.getByText(/별·언어·최근 업데이트/);
    expect(line.textContent).toMatch(/2026\D+09\D+12\D*기준/);
    expect(line.className).toContain("text-2xs");
    expect(line.className).toContain("text-muted");
    // 셋이 한 번의 fetch 를 공유하므로 별에만 따로 붙던 꼬리표는 걷는다.
    expect(container.textContent ?? "").not.toContain("수집 시점 값");
  });

  it("조회 안 한 후보에는 왜 비었는지 적는다 — 빈칸은 고장으로 읽힌다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/수집 당시 저장하지 않았습니다/)).toBeInTheDocument();
    // 물어본 적이 없으므로 '없음'이 아니라 대시다.
    expect(screen.queryByText("없음")).not.toBeInTheDocument();
  });

  it("DB 에 없는 칸을 만들지 않는다 — 사용 시점·사용 방법", () => {
    const { container } = render(<AiTipCandidateView row={syncedRow} />);
    const text = container.textContent ?? "";
    for (const absent of ["사용 시점", "사용 방법"]) {
      expect(text).not.toContain(absent);
    }
  });
});

vi.mock("@/features/ai-tip-candidates/actions", () => ({
  promoteCandidateAction: vi.fn(async () => ({ ok: true, message: "등록했습니다." })),
  hideCandidateAction: vi.fn(async () => ({ ok: true, message: "숨겼습니다." })),
  unhideCandidateAction: vi.fn(async () => ({ ok: true, message: "되돌렸습니다." })),
}));

const mockPromote = vi.mocked(promoteCandidateAction);
const mockHide = vi.mocked(hideCandidateAction);
const mockUnhide = vi.mocked(unhideCandidateAction);

function idSentTo(mock: ReturnType<typeof vi.mocked<typeof promoteCandidateAction>>) {
  const formData = mock.mock.calls[0]?.[1];
  return formData?.get("id");
}

describe("AiTipCandidateView — 등록·숨김·되돌리기", () => {
  beforeEach(() => {
    mockPromote.mockClear();
    mockHide.mockClear();
    mockUnhide.mockClear();
  });

  it("검토 대기 + 권한이면 등록·숨김을 준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByRole("button", { name: "TIP 등록" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "숨김" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "되돌리기" }),
    ).not.toBeInTheDocument();
  });

  it("숨김을 되돌릴 수 있다고 알린다 — 수집기가 숨긴 리포를 다시 안 가져온다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/되돌릴 수 있습니다/)).toBeInTheDocument();
  });

  it("숨긴 후보에는 되돌리기만 준다", () => {
    render(
      <AiTipCandidateView
        row={{ ...baseRow, tipCandidateStatus: "hidden" }}
      />,
    );
    expect(screen.getByRole("button", { name: "되돌리기" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "TIP 등록" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "숨김" })).not.toBeInTheDocument();
  });

  it("등록된 후보에는 버튼 없이 안내만 남는다", () => {
    render(
      <AiTipCandidateView
        row={{ ...baseRow, tipCandidateStatus: "promoted" }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/이미 TIP 으로 등록/)).toBeInTheDocument();
  });

  it("권한이 없으면 버튼 대신 안내문이다 — readOnly 는 편집 모드만 막는다", () => {
    render(
      <AiTipCandidateView
        row={{ ...baseRow, tipCandidateCanDecide: false }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한이 없으면 숨긴 후보도 되돌릴 수 없다", () => {
    render(
      <AiTipCandidateView
        row={{
          ...baseRow,
          tipCandidateStatus: "hidden",
          tipCandidateCanDecide: false,
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "되돌리기" }),
    ).not.toBeInTheDocument();
  });

  it("등록 버튼은 후보 id 를 액션에 보낸다", async () => {
    render(<AiTipCandidateView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: "TIP 등록" }));
    await waitFor(() => expect(mockPromote).toHaveBeenCalled());
    expect(idSentTo(mockPromote)).toBe(baseRow.id);
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("숨김 버튼은 숨김 액션을 부른다", async () => {
    render(<AiTipCandidateView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: "숨김" }));
    await waitFor(() => expect(mockHide).toHaveBeenCalled());
    expect(idSentTo(mockHide)).toBe(baseRow.id);
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it("되돌리기 버튼은 되돌리기 액션을 부른다", async () => {
    render(
      <AiTipCandidateView row={{ ...baseRow, tipCandidateStatus: "hidden" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    await waitFor(() => expect(mockUnhide).toHaveBeenCalled());
    expect(idSentTo(mockUnhide)).toBe(baseRow.id);
  });
});

/**
 * 실패를 `alert()` 로 띄우면 누르는 순간 사라져, 무엇이 왜 막혔는지 다시 볼 수
 * 없다. 구 후보 패널이 그랬다. 결과는 인스펙터에 남긴다.
 */
describe("AiTipCandidateView — 결과 표시", () => {
  beforeEach(() => {
    mockPromote.mockClear();
    mockHide.mockClear();
    mockUnhide.mockClear();
  });

  it("실패 메시지를 인스펙터에 남긴다 — 주의 색으로", async () => {
    mockPromote.mockResolvedValueOnce({
      ok: false,
      message: "권한 없음 — TIP 등록 권한이 없습니다.",
    });
    render(<AiTipCandidateView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: "TIP 등록" }));
    const message = await screen.findByText(/권한 없음/);
    expect(message.className).toContain("text-vermilion");
  });

  it("성공 메시지는 기본 글자색이다", async () => {
    mockHide.mockResolvedValueOnce({ ok: true, message: "숨김으로 옮겼습니다." });
    render(<AiTipCandidateView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: "숨김" }));
    const message = await screen.findByText("숨김으로 옮겼습니다.");
    expect(message.className).toContain("text-ink");
    expect(message.className).not.toContain("text-vermilion");
  });

  it("실패해도 alert 을 띄우지 않는다", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockUnhide.mockResolvedValueOnce({ ok: false, message: "되돌리지 못했습니다." });
    render(
      <AiTipCandidateView row={{ ...baseRow, tipCandidateStatus: "hidden" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    await screen.findByText("되돌리지 못했습니다.");
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
