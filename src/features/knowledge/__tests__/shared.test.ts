import { describe, it, expect } from "vitest";
import { groupByCategory, isStale, CATEGORY_ORDER } from "../shared";
import type { KnowledgeDocRow } from "../shared";

function row(p: Partial<KnowledgeDocRow>): KnowledgeDocRow {
  return {
    path: "개념/x.md",
    category: "개념",
    title: "x",
    owner: null,
    updated: null,
    related: [],
    missing: [],
    categoryMismatch: false,
    ...p,
  };
}

describe("groupByCategory", () => {
  it("설계에 정한 분류 순서로 묶는다 — 알파벳순이 아니다", () => {
    const groups = groupByCategory([
      row({ path: "규칙/a.md", category: "규칙", title: "a" }),
      row({ path: "개념/b.md", category: "개념", title: "b" }),
      row({ path: "플레이북/c.md", category: "플레이북", title: "c" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      "개념",
      "플레이북",
      "규칙",
    ]);
  });

  it("문서가 없는 분류는 빼고, 분류 안은 제목순", () => {
    const groups = groupByCategory([
      row({ path: "개념/나.md", category: "개념", title: "나" }),
      row({ path: "개념/가.md", category: "개념", title: "가" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].docs.map((d) => d.title)).toEqual(["가", "나"]);
  });

  it("형식 미비 문서는 '미분류'로 따로 모은다 — 안 보이면 아무도 안 고친다", () => {
    const groups = groupByCategory([
      row({ path: "개념/온전.md", category: "개념", title: "온전" }),
      row({
        path: "개념/빈약.md",
        category: "개념",
        title: "빈약",
        missing: ["owner"],
      }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["개념", "미분류"]);
    // 원래 분류에도 남는다 — 미분류는 버리는 칸이 아니라 고칠 목록이다
    expect(groups[0].docs.map((d) => d.title)).toEqual(["빈약", "온전"]);
    expect(groups[1].docs.map((d) => d.title)).toEqual(["빈약"]);
  });

  it("설계에 없는 분류(폴더를 임의로 만든 경우)도 버리지 않고 뒤에 붙인다", () => {
    const groups = groupByCategory([
      row({ path: "잡동사니/a.md", category: "잡동사니", title: "a" }),
      row({ path: "개념/b.md", category: "개념", title: "b" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["개념", "잡동사니"]);
  });
});

describe("isStale", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("6개월 넘은 문서는 낡음", () => {
    expect(isStale("2026-02-01", now)).toBe(true);
  });

  it("6개월 이내면 낡지 않음", () => {
    expect(isStale("2026-06-01", now)).toBe(false);
  });

  it("updated가 없으면 낡음으로 보지 않는다 — 누락은 missing이 따로 잡는다", () => {
    expect(isStale(null, now)).toBe(false);
  });
});

describe("CATEGORY_ORDER", () => {
  it("설계 §3의 7개 분류를 그 순서로 담는다", () => {
    expect(CATEGORY_ORDER).toEqual([
      "개념",
      "플레이북",
      "규칙",
      "결정",
      "오류사례",
      "엔티티",
      "프로젝트",
    ]);
  });

  it("제안은 목록에 없다 — 에이전트 초안 칸이라 열람 화면에 섞지 않는다", () => {
    expect(CATEGORY_ORDER).not.toContain("제안");
  });
});
