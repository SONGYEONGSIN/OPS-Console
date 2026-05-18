import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChecklistTab } from "../ChecklistTab";
import type { GuideSection } from "../../_components/patterns/GuidePattern";

const sections: GuideSection[] = [
  {
    ico: "①",
    title: "입사 및 계정 설정",
    description: "첫날 인사",
    items: [
      { title: "인사 및 자리 안내", detail: "팀장 인사" },
      { title: "계정 발급", detail: "지문 등록" },
    ],
  },
  {
    ico: "②",
    title: "조직 소개",
    items: [{ title: "조직 구조 학습", detail: "팀 구성 확인" }],
  },
];

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard/onboarding",
  useSearchParams: () => new URLSearchParams("tab=checklist"),
}));

describe("ChecklistTab", () => {
  it("cohorts 비어있을 때 안내문 표시 — 체크박스 미렌더", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[]}
        selectedCohortId={null}
        initialChecks={{}}
        canToggle={false}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/회차가 없습니다|admin이 회차를 생성|회차 미배정/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("cohort 1개 + 선택됨 — dropdown 숨김, 체크박스 렌더", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[{ id: "c1", title: "회차 1 — 김지나" }]}
        selectedCohortId="c1"
        initialChecks={{}}
        canToggle={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
  });

  it("cohort 2+ — dropdown 노출 + 선택값 표시", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[
          { id: "c1", title: "회차 1 — 김지나" },
          { id: "c2", title: "회차 2 — 이몽룡" },
        ]}
        selectedCohortId="c2"
        initialChecks={{}}
        canToggle={true}
        onToggle={vi.fn()}
      />,
    );
    const dropdown = screen.getByRole("combobox");
    expect((dropdown as HTMLSelectElement).value).toBe("c2");
  });

  it("dropdown 변경 → URL ?cohort= replace", () => {
    replaceMock.mockClear();
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[
          { id: "c1", title: "회차 1" },
          { id: "c2", title: "회차 2" },
        ]}
        selectedCohortId="c1"
        initialChecks={{}}
        canToggle={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "c2" },
    });
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("cohort=c2"),
      expect.anything(),
    );
  });

  it("initialChecks 반영 — 해당 항목 checked", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[{ id: "c1", title: "회차 1" }]}
        selectedCohortId="c1"
        initialChecks={{ "입사 및 계정 설정::계정 발급": true }}
        canToggle={true}
        onToggle={vi.fn()}
      />,
    );
    const checked = screen.getByRole("checkbox", { name: /계정 발급/ });
    expect((checked as HTMLInputElement).checked).toBe(true);
    const unchecked = screen.getByRole("checkbox", {
      name: /인사 및 자리 안내/,
    });
    expect((unchecked as HTMLInputElement).checked).toBe(false);
  });

  it("진행률 표시 — 체크된 비율 %", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[{ id: "c1", title: "회차 1" }]}
        selectedCohortId="c1"
        initialChecks={{
          "입사 및 계정 설정::계정 발급": true,
        }}
        canToggle={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument();
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it("체크박스 클릭 → onToggle 호출 (selectedCohortId 사용)", () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[
          { id: "c1", title: "회차 1" },
          { id: "c2", title: "회차 2" },
        ]}
        selectedCohortId="c2"
        initialChecks={{}}
        canToggle={true}
        onToggle={onToggle}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /계정 발급/ });
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith({
      cohort_id: "c2",
      section_key: "입사 및 계정 설정",
      item_key: "계정 발급",
      checked: true,
    });
  });

  it("canToggle=false → 체크박스 disabled", () => {
    render(
      <ChecklistTab
        sections={sections}
        cohorts={[{ id: "c1", title: "회차 1" }]}
        selectedCohortId="c1"
        initialChecks={{}}
        canToggle={false}
        onToggle={vi.fn()}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /계정 발급/ });
    expect((box as HTMLInputElement).disabled).toBe(true);
  });
});
