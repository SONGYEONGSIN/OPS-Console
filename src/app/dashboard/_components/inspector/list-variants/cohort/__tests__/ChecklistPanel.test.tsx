import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CohortChecklistPanel } from "../ChecklistPanel";

// 콘텐츠는 정적이므로 결정적 섹션으로 모킹 (실제 항목 변경에 테스트 비결합)
vi.mock("@/app/dashboard/onboarding/_content", () => ({
  onboardingGuideSections: [
    {
      ico: "①",
      title: "입사 및 계정 설정",
      description: "첫날 세팅",
      items: [
        { title: "인사 및 자리 안내", detail: "팀장 인사" },
        { title: "계정 발급", detail: "지문 등록" },
      ],
    },
    {
      ico: "②",
      title: "조직 소개",
      items: [{ title: "조직 구조 학습", detail: "팀 구성" }],
    },
  ],
}));

const key = (s: string, i: string) => `${s}::${i}`;

describe("CohortChecklistPanel", () => {
  it("진행도 카운트 + 섹션/항목 제목 표시", () => {
    render(
      <CohortChecklistPanel
        cohortId="c1"
        initialChecks={{ [key("입사 및 계정 설정", "계정 발급")]: true }}
        canToggle
        onToggle={vi.fn()}
      />,
    );
    // 총 3항목 중 1 체크
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("인사 및 자리 안내")).toBeInTheDocument();
    expect(screen.getByText("조직 구조 학습")).toBeInTheDocument();
  });

  it("canToggle=false — 체크박스 비활성(읽기 전용)", () => {
    render(
      <CohortChecklistPanel
        cohortId="c1"
        initialChecks={{}}
        canToggle={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("계정 발급")).toBeDisabled();
  });

  it("canToggle=true — 체크 시 onToggle 호출(section/item key)", async () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true });
    render(
      <CohortChecklistPanel
        cohortId="c1"
        initialChecks={{}}
        canToggle
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText("계정 발급"));
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1));
    expect(onToggle).toHaveBeenCalledWith({
      cohort_id: "c1",
      section_key: "입사 및 계정 설정",
      item_key: "계정 발급",
      checked: true,
    });
  });

  it("토글 실패 시 낙관적 체크 롤백 + 에러 표시", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "권한 없음" });
    render(
      <CohortChecklistPanel
        cohortId="c1"
        initialChecks={{}}
        canToggle
        onToggle={onToggle}
      />,
    );
    const box = screen.getByLabelText("계정 발급") as HTMLInputElement;
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByText("권한 없음")).toBeInTheDocument());
    expect(box.checked).toBe(false);
  });
});
