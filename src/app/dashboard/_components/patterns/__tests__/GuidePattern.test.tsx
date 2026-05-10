import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidePattern } from "../GuidePattern";
import type { GuideTab } from "../GuidePattern";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: () => {} }),
  usePathname: () => "/dashboard/onboarding",
}));

const sections = [
  {
    ico: "①",
    title: "입사 첫날",
    description: "인사·자리·계정",
    items: [
      { title: "인사 및 자리 안내", detail: "팀장/사수 매니저와 인사" },
      { title: "계정 발급", detail: "Slack/노션/지문" },
    ],
  },
];

const tabs: GuideTab[] = [
  { value: "guide", label: "온보딩 가이드", sections },
  { value: "checklist", label: "체크리스트", placeholder: "후속 epic" },
  { value: "cohort", label: "회차 관리", children: <div>cohort children</div> },
  { value: "log", label: "활동 로그", placeholder: "후속" },
];

describe("GuidePattern", () => {
  it("탭 4개 모두 노출", () => {
    render(<GuidePattern title="온보딩" tabs={tabs} />);
    expect(screen.getByRole("tab", { name: "온보딩 가이드" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "체크리스트" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "회차 관리" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "활동 로그" })).toBeInTheDocument();
  });

  it("기본 탭(첫 번째)이 active — sections 카드 그룹 표시", () => {
    render(<GuidePattern title="온보딩" tabs={tabs} />);
    expect(screen.getByText("입사 첫날")).toBeInTheDocument();
    expect(screen.getByText("인사 및 자리 안내")).toBeInTheDocument();
  });

  it("탭 클릭 → 다른 탭 콘텐츠로 전환", () => {
    render(<GuidePattern title="온보딩" tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: "회차 관리" }));
    expect(screen.getByText("cohort children")).toBeInTheDocument();
  });

  it("placeholder 탭 클릭 시 안내문 표시", () => {
    render(<GuidePattern title="온보딩" tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: "체크리스트" }));
    expect(screen.getByText(/후속 epic/)).toBeInTheDocument();
  });

  it("section 항목에 자동 번호(1, 2, ...) 노출", () => {
    render(<GuidePattern title="온보딩" tabs={tabs} />);
    // 첫 번째 항목 옆에 '1' 표시
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
