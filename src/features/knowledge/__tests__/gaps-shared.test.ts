import { describe, it, expect } from "vitest";
import { groupGaps, GAP_KIND_LABEL, type KnowledgeGapRow } from "../gaps-shared";

const row = (over: Partial<KnowledgeGapRow>): KnowledgeGapRow => ({
  id: "1",
  kind: "missing",
  topic: "휴가 등록 절차",
  note: null,
  nearPaths: [],
  question: "휴가 등록 어떻게해?",
  createdAt: "2026-08-18T00:00:00Z",
  ...over,
});

describe("groupGaps", () => {
  it("같은 주제를 묶고 횟수를 센다 — 반복이 곧 우선순위다", () => {
    const g = groupGaps([
      row({ id: "1" }),
      row({ id: "2", question: "연차 어떻게 올려?" }),
      row({ id: "3", topic: "백업요청 화면 조작", kind: "shallow" }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].topic).toBe("휴가 등록 절차");
    expect(g[0].count).toBe(2);
  });

  it("많이 물어본 주제가 먼저 온다", () => {
    const g = groupGaps([
      row({ id: "1", topic: "A" }),
      row({ id: "2", topic: "B" }),
      row({ id: "3", topic: "B" }),
    ]);
    expect(g[0].topic).toBe("B");
  });

  it("같은 주제의 질문을 모아 보여준다 — 무엇을 쓸지 알려면 원문이 필요하다", () => {
    const g = groupGaps([
      row({ id: "1", question: "휴가 등록 어떻게해?" }),
      row({ id: "2", question: "연차 어떻게 올려?" }),
    ]);
    expect(g[0].questions).toEqual(["휴가 등록 어떻게해?", "연차 어떻게 올려?"]);
  });

  it("같은 질문이 반복되면 한 번만 보여준다", () => {
    const g = groupGaps([row({ id: "1" }), row({ id: "2" })]);
    expect(g[0].questions).toEqual(["휴가 등록 어떻게해?"]);
    expect(g[0].count).toBe(2);
  });

  it("shallow면 보강할 문서 경로를 모은다 — 새로 쓰는 게 아니라 고치는 일이다", () => {
    const g = groupGaps([
      row({ id: "1", kind: "shallow", nearPaths: ["플레이북/백업 요청 그룹별 발송.md"] }),
      row({ id: "2", kind: "shallow", nearPaths: ["플레이북/백업 요청 그룹별 발송.md", "규칙/x.md"] }),
    ]);
    expect(g[0].nearPaths).toEqual([
      "플레이북/백업 요청 그룹별 발송.md",
      "규칙/x.md",
    ]);
  });

  it("한 주제에 구분이 섞이면 더 많이 나온 쪽을 따른다", () => {
    const g = groupGaps([
      row({ id: "1", kind: "shallow" }),
      row({ id: "2", kind: "shallow" }),
      row({ id: "3", kind: "missing" }),
    ]);
    expect(g[0].kind).toBe("shallow");
  });

  it("빈 입력은 빈 배열", () => {
    expect(groupGaps([])).toEqual([]);
  });
});

describe("GAP_KIND_LABEL", () => {
  it("세 갈래가 화면에서 다른 일을 뜻한다고 읽혀야 한다", () => {
    expect(GAP_KIND_LABEL.missing).toMatch(/없/);
    expect(GAP_KIND_LABEL.shallow).toMatch(/보강|부족/);
    expect(GAP_KIND_LABEL.tool).toMatch(/도구|데이터/);
  });
});
