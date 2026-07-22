import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareLinks } from "../ShareLinks";
import {
  issueTokenAction,
  toggleTokenAction,
} from "@/features/checklist/actions";
import { DEPARTMENTS, type ShareToken } from "@/features/checklist/schemas";

vi.mock("@/features/checklist/actions", () => ({
  issueTokenAction: vi.fn(),
  toggleTokenAction: vi.fn(),
}));

const mockIssue = vi.mocked(issueTokenAction);
const mockToggle = vi.mocked(toggleTokenAction);

const roundId = "11111111-1111-1111-1111-111111111111";

function makeToken(overrides: Partial<ShareToken> = {}): ShareToken {
  return {
    id: "tok-1",
    roundId,
    kind: "dept-fill",
    department: DEPARTMENTS[0],
    token: "dept-token-abc",
    enabled: true,
    ...overrides,
  };
}

describe("ShareLinks", () => {
  beforeEach(() => {
    mockIssue.mockReset();
    mockToggle.mockReset();
    mockIssue.mockResolvedValue({ ok: true, token: "new-token" });
    mockToggle.mockResolvedValue({ ok: true });
  });

  it("부서별 토큰 미발급 → 발급 버튼 노출, 클릭 시 issueTokenAction(roundId,'dept-fill',부서) 호출", async () => {
    render(<ShareLinks roundId={roundId} tokens={[]} />);
    expect(screen.getByText(DEPARTMENTS[0])).toBeInTheDocument();
    const issueButtons = screen.getAllByText("발급");
    // 부서별 버튼 + 임원 보고 버튼
    expect(issueButtons).toHaveLength(DEPARTMENTS.length + 1);
    fireEvent.click(issueButtons[0]);
    await waitFor(() =>
      expect(mockIssue).toHaveBeenCalledWith(
        roundId,
        "dept-fill",
        DEPARTMENTS[0],
      ),
    );
  });

  it("발급된 부서 토큰 → '링크 복사' + '비활성' 버튼 노출", () => {
    render(<ShareLinks roundId={roundId} tokens={[makeToken()]} />);
    expect(screen.getByText("링크 복사")).toBeInTheDocument();
    expect(screen.getByText("비활성")).toBeInTheDocument();
  });

  it("'링크 복사' 클릭 → clipboard에 /r/checklist/{token} 절대 URL 기록", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ShareLinks roundId={roundId} tokens={[makeToken()]} />);
    fireEvent.click(screen.getByText("링크 복사"));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/r/checklist/dept-token-abc`,
    );
  });

  it("'비활성' 클릭 → toggleTokenAction(tokenId, roundId, false) 호출", async () => {
    render(
      <ShareLinks roundId={roundId} tokens={[makeToken({ enabled: true })]} />,
    );
    fireEvent.click(screen.getByText("비활성"));
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith("tok-1", roundId, false),
    );
  });

  it("비활성 토큰 → '활성' 버튼 노출, 클릭 시 toggleTokenAction(...,true) 호출", async () => {
    render(
      <ShareLinks roundId={roundId} tokens={[makeToken({ enabled: false })]} />,
    );
    fireEvent.click(screen.getByText("활성"));
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith("tok-1", roundId, true),
    );
  });

  it("임원 보고 링크 미발급 → 발급 클릭 시 issueTokenAction(roundId,'report',null) 호출", async () => {
    render(<ShareLinks roundId={roundId} tokens={[]} />);
    const issueButtons = screen.getAllByText("발급");
    fireEvent.click(issueButtons[issueButtons.length - 1]);
    await waitFor(() =>
      expect(mockIssue).toHaveBeenCalledWith(roundId, "report", null),
    );
  });

  it("임원 보고 링크 발급됨 → '복사' 버튼 노출", () => {
    const reportToken = makeToken({
      id: "tok-report",
      kind: "report",
      department: null,
      token: "report-tok",
    });
    render(<ShareLinks roundId={roundId} tokens={[reportToken]} />);
    expect(screen.getByText("복사")).toBeInTheDocument();
  });
});
