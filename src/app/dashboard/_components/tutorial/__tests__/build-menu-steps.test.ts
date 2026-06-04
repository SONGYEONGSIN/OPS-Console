import { describe, it, expect } from "vitest";
import type { SbSection } from "../../../_data";
import type { MenuCopy } from "../tutorial-menu-copy";
import { buildMenuTutorialSteps } from "../build-menu-steps";

const copy: Record<string, MenuCopy> = {
  "my-todo": {
    overview: "내 작업 개요",
    interaction: "행을 우측으로 끌어 담습니다",
    buttons: [{ label: "+ 담기", desc: "할 일에 추가" }],
  },
  incidents: {
    overview: "사고 보고 개요",
    interaction: "행을 클릭하면 인스펙터가 열립니다",
    buttons: [], // 버튼 콘텐츠 없음 → 버튼 스텝 생략
  },
};

const sectionWith = (...entries: SbSection["entries"]): SbSection[] => [
  { title: "테스트", entries },
];

describe("buildMenuTutorialSteps", () => {
  it("권한으로 보이는 메뉴가 없으면(빈 sections) 빈 배열", () => {
    expect(buildMenuTutorialSteps([], copy)).toEqual([]);
  });

  it("slug 없는 항목(예: 실시간 현황)은 스텝을 만들지 않는다", () => {
    const sections = sectionWith({
      kind: "item",
      ico: "◉",
      label: "실시간 현황",
    });
    expect(buildMenuTutorialSteps(sections, copy)).toEqual([]);
  });

  it("copy에 없는 slug는 제외한다", () => {
    const sections = sectionWith({
      kind: "item",
      ico: "▤",
      label: "연락처",
      slug: "contacts", // copy에 없음
    });
    expect(buildMenuTutorialSteps(sections, copy)).toEqual([]);
  });

  it("버튼이 있는 메뉴는 3스텝(개요·인터랙션·버튼)을 만든다", () => {
    const sections = sectionWith({
      kind: "item",
      ico: "✓",
      label: "내 작업",
      slug: "my-todo",
    });
    const steps = buildMenuTutorialSteps(sections, copy);
    expect(steps).toHaveLength(3);
    expect(steps[0]!.element).toBe("[data-tutorial-slug='my-todo']");
    expect(steps[0]!.title).toContain("내 작업");
    expect(steps[0]!.description).toBe("내 작업 개요");
    expect(steps[1]!.element).toBe("[data-tutorial='content']");
    expect(steps[1]!.description).toBe("행을 우측으로 끌어 담습니다");
    expect(steps[2]!.description).toContain("+ 담기");
  });

  it("버튼이 없는 메뉴는 버튼 스텝을 생략한다(2스텝)", () => {
    const sections = sectionWith({
      kind: "item",
      ico: "▤",
      label: "사고 보고",
      slug: "incidents",
    });
    expect(buildMenuTutorialSteps(sections, copy)).toHaveLength(2);
  });

  it("그룹 안에 있는 메뉴도 포함한다", () => {
    const sections = sectionWith({
      kind: "group",
      label: "요청·자료",
      items: [
        { ico: "▤", label: "사고 보고", slug: "incidents" },
        { ico: "▤", label: "연락처", slug: "contacts" }, // copy 없음 → 제외
      ],
    });
    const steps = buildMenuTutorialSteps(sections, copy);
    // incidents 2스텝만 (contacts 제외)
    expect(steps).toHaveLength(2);
    expect(steps[0]!.title).toContain("사고 보고");
  });

  it("사이드바 순서대로 스텝을 생성한다", () => {
    const sections = sectionWith(
      { kind: "item", ico: "✓", label: "내 작업", slug: "my-todo" },
      { kind: "item", ico: "▤", label: "사고 보고", slug: "incidents" },
    );
    const steps = buildMenuTutorialSteps(sections, copy);
    // my-todo(3) + incidents(2) = 5, my-todo 먼저
    expect(steps).toHaveLength(5);
    expect(steps[0]!.title).toContain("내 작업");
    expect(steps[3]!.title).toContain("사고 보고");
  });
});
