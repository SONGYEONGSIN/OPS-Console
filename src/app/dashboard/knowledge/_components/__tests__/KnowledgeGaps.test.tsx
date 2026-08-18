import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import { KnowledgeGaps } from "../KnowledgeGaps";
import type { KnowledgeGapGroup } from "@/features/knowledge/gaps-shared";

const { closeSpy } = vi.hoisted(() => ({ closeSpy: vi.fn() }));
vi.mock("@/features/knowledge/gap-actions", () => ({
  closeGapTopic: (...a: unknown[]) => {
    closeSpy(...a);
    return Promise.resolve({ ok: true });
  },
}));

const GROUPS: KnowledgeGapGroup[] = [
  {
    topic: "휴가 등록 절차",
    kind: "missing",
    count: 3,
    questions: ["휴가 등록 어떻게해?", "연차 올리는 법"],
    nearPaths: [],
    notes: ["볼트에 근태 문서가 없다"],
    proposalPath: null,
  },
  {
    topic: "백업요청 화면 조작",
    kind: "shallow",
    count: 1,
    questions: ["백업요청 어떻게 해?"],
    nearPaths: ["플레이북/백업 요청 그룹별 발송.md"],
    notes: [],
    proposalPath: null,
  },
];

describe("KnowledgeGaps", () => {
  beforeEach(() => closeSpy.mockClear());

  it("주제와 물어본 횟수를 보여준다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText("휴가 등록 절차")).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("구분을 라벨로 보여준다 — 새로 쓸 일과 보강할 일은 다르다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText(/문서 없음/)).toBeInTheDocument();
    expect(screen.getByText("내용 부족 · 보강")).toBeInTheDocument();
  });

  it("실제 질문을 그대로 보여준다 — 무엇을 쓸지는 원문이 알려준다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText(/휴가 등록 어떻게해\?/)).toBeInTheDocument();
  });

  it("보강 대상 문서로 바로 갈 수 있다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    const link = screen.getByRole("link", { name: /백업 요청 그룹별 발송/ });
    expect(link.getAttribute("href")).toContain("doc=");
  });

  it("초안이 이미 있으면 '검토'로 안내한다 — 또 쓰지 않게", () => {
    render(
      <KnowledgeGaps
        groups={[{ ...GROUPS[0], proposalPath: "제안/부산대학교 수시 서비스 세팅.md" }]}
      />,
    );
    expect(screen.getByText(/초안 대기/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /부산대학교 수시 서비스 세팅/ });
    expect(link.getAttribute("href")).toContain("doc=");
  });

  it("초안이 없으면 초안을 요청할 수 있다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getAllByRole("button", { name: /초안 요청/ }).length).toBeGreaterThan(0);
  });

  it("초안이 이미 있으면 요청 버튼을 안 보여준다 — 두 번 만들면 덮어쓰기 실패만 난다", () => {
    render(
      <KnowledgeGaps
        groups={[{ ...GROUPS[0], proposalPath: "제안/x.md" }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /초안 요청/ })).toBeNull();
  });

  it("해결로 닫으면 주제를 넘긴다", async () => {
    render(<KnowledgeGaps groups={[GROUPS[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: "해결" }));
    await waitFor(() =>
      expect(closeSpy).toHaveBeenCalledWith("휴가 등록 절차", "resolved"),
    );
  });

  it("필요 없음으로도 닫는다", async () => {
    render(<KnowledgeGaps groups={[GROUPS[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: "필요 없음" }));
    await waitFor(() =>
      expect(closeSpy).toHaveBeenCalledWith("휴가 등록 절차", "dismissed"),
    );
  });

  it("검토 대기 중인 초안을 따로 보여준다 — 이미 있는 걸 또 쓰지 않게", () => {
    render(
      <KnowledgeGaps
        groups={GROUPS}
        proposals={[
          { path: "제안/부산대학교 수시 서비스 세팅.md", title: "부산대학교 수시 서비스 세팅" },
        ]}
      />,
    );
    expect(screen.getByText(/검토 대기/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /부산대학교 수시 서비스 세팅/ }),
    ).toBeInTheDocument();
  });

  it("빈틈은 없는데 대기 초안만 있어도 보여준다", () => {
    render(
      <KnowledgeGaps
        groups={[]}
        proposals={[{ path: "제안/x.md", title: "x" }]}
      />,
    );
    expect(screen.getByText(/검토 대기/)).toBeInTheDocument();
  });

  it("빈틈이 없으면 그렇다고 말한다", () => {
    render(<KnowledgeGaps groups={[]} />);
    expect(screen.getByText(/답하지 못한 질문이 없습니다/)).toBeInTheDocument();
  });
});
