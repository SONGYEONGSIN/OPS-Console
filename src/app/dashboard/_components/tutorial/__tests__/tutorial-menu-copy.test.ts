import { describe, it, expect } from "vitest";
import {
  MENU_COPY,
  isMenuCopyComplete,
  type MenuCopy,
} from "../tutorial-menu-copy";

describe("MENU_COPY 무결성", () => {
  it("등록된 모든 메뉴는 완전한 콘텐츠를 가진다 (빈 문구 금지)", () => {
    for (const [slug, copy] of Object.entries(MENU_COPY)) {
      expect(isMenuCopyComplete(copy), `${slug} 콘텐츠 누락`).toBe(true);
    }
  });

  it("slug 키는 kebab-case 형식이다", () => {
    for (const slug of Object.keys(MENU_COPY)) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("시드 메뉴 my-todo가 존재한다", () => {
    expect(MENU_COPY["my-todo"]).toBeDefined();
  });

  it("운영 핵심 batch(handover·backup·receivables·services·contracts)를 모두 포함한다", () => {
    for (const slug of [
      "handover",
      "backup",
      "receivables",
      "services",
      "contracts",
    ]) {
      expect(MENU_COPY[slug], `${slug} 콘텐츠 누락`).toBeDefined();
    }
  });

  it("요청·자료 batch(incidents·contacts·data-requests)를 모두 포함한다", () => {
    // vault·meetings는 페이지 미구현이라 제외 — 빌더가 skip한다.
    for (const slug of ["incidents", "contacts", "data-requests"]) {
      expect(MENU_COPY[slug], `${slug} 콘텐츠 누락`).toBeDefined();
    }
  });
});

describe("isMenuCopyComplete", () => {
  const base: MenuCopy = {
    overview: "개요",
    interaction: "상호작용",
    buttons: [{ label: "버튼", desc: "설명" }],
  };

  it("모든 필드가 채워지면 true", () => {
    expect(isMenuCopyComplete(base)).toBe(true);
  });

  it("overview가 비면 false", () => {
    expect(isMenuCopyComplete({ ...base, overview: "  " })).toBe(false);
  });

  it("interaction이 비면 false", () => {
    expect(isMenuCopyComplete({ ...base, interaction: "" })).toBe(false);
  });

  it("버튼 desc가 비면 false", () => {
    expect(
      isMenuCopyComplete({ ...base, buttons: [{ label: "x", desc: "" }] }),
    ).toBe(false);
  });

  it("버튼 label이 비면 false", () => {
    expect(
      isMenuCopyComplete({ ...base, buttons: [{ label: " ", desc: "y" }] }),
    ).toBe(false);
  });

  it("버튼이 없어도(빈 배열) overview/interaction만 있으면 true", () => {
    expect(isMenuCopyComplete({ ...base, buttons: [] })).toBe(true);
  });
});
