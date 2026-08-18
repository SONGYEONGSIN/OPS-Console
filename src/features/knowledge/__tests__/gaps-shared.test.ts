import { describe, it, expect } from "vitest";
import {
  groupGaps,
  GAP_KIND_LABEL,
  normalizeTopic,
  type KnowledgeGapRow,
} from "../gaps-shared";

const row = (over: Partial<KnowledgeGapRow>): KnowledgeGapRow => ({
  id: "1",
  kind: "missing",
  topic: "휴가 등록 절차",
  note: null,
  nearPaths: [],
  question: "휴가 등록 어떻게해?",
  proposalPath: null,
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

  it("초안이 있으면 주제에 달아준다 — 이미 검토 대기 중인 걸 모르면 또 쓴다", () => {
    const g = groupGaps([
      row({ id: "1" }),
      row({ id: "2", proposalPath: "제안/부산대학교 수시 서비스 세팅.md" }),
    ]);
    expect(g[0].proposalPath).toBe("제안/부산대학교 수시 서비스 세팅.md");
  });

  it("초안이 없으면 null", () => {
    expect(groupGaps([row({ id: "1" })])[0].proposalPath).toBeNull();
  });
});

describe("GAP_KIND_LABEL", () => {
  it("세 갈래가 화면에서 다른 일을 뜻한다고 읽혀야 한다", () => {
    expect(GAP_KIND_LABEL.missing).toMatch(/없/);
    expect(GAP_KIND_LABEL.shallow).toMatch(/보강|부족/);
    expect(GAP_KIND_LABEL.tool).toMatch(/도구|데이터/);
  });
});

/**
 * 주제를 문자열 완전일치로 묶었더니 실제로 흩어졌다(2026-08-19 관측):
 *   휴가 신청 절차 / 휴가 등록 절차 / 휴가 등록
 *   대학 담당자 전화·이메일 / 대학 담당자 연락처(전화·이메일)
 * 3회짜리가 1회 세 개로 보이면 '많이 물어본 순'이라는 요점이 무너진다.
 */
describe("normalizeTopic", () => {
  it("괄호와 그 안을 뺀다", () => {
    expect(normalizeTopic("대학 담당자 연락처(전화·이메일)")).toBe(
      normalizeTopic("대학 담당자 연락처"),
    );
  });

  it("공백·가운뎃점 차이를 무시한다", () => {
    expect(normalizeTopic("대학 담당자 전화·이메일")).toBe(
      normalizeTopic("대학담당자 전화 이메일"),
    );
  });

  it("절차·방법 같은 꼬리말을 뗀다 — 같은 걸 다르게 부른 것뿐이다", () => {
    expect(normalizeTopic("휴가 등록 절차")).toBe(normalizeTopic("휴가 등록"));
    expect(normalizeTopic("휴가 신청 방법")).toBe(normalizeTopic("휴가 신청"));
  });

  it("동의어까지 합치지는 않는다 — '등록'과 '신청'은 다른 낱말이다", () => {
    // 뜻으로 묶는 건 사람이나 모델의 일이다. 여기서 과하게 합치면 다른 주제가
    // 뭉쳐 우선순위를 거짓으로 부풀린다 — 흩어지는 것보다 나쁘다.
    expect(normalizeTopic("휴가 등록")).not.toBe(normalizeTopic("휴가 신청"));
  });

  it("뜻이 다른 주제는 안 합친다", () => {
    expect(normalizeTopic("휴가 등록")).not.toBe(normalizeTopic("백업요청 발송"));
  });

  it("빈 문자열은 그대로", () => {
    expect(normalizeTopic("   ")).toBe("");
  });
});

describe("groupGaps — 비슷한 주제 묶기", () => {
  it("표기가 달라도 한 주제로 센다", () => {
    const g = groupGaps([
      row({ id: "1", topic: "휴가 등록 절차", question: "휴가 등록 어떻게 해" }),
      row({ id: "2", topic: "휴가 등록", question: "휴가 등록하고 싶어" }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(2);
  });

  it("괄호 보충만 다른 것도 한 주제", () => {
    const g = groupGaps([
      row({ id: "1", topic: "대학 담당자 연락처" }),
      row({ id: "2", topic: "대학 담당자 연락처(전화·이메일)" }),
    ]);
    expect(g).toHaveLength(1);
  });

  it("보여주는 이름은 가장 많이 쓰인 표기 — 사람이 쓴 말을 남긴다", () => {
    const g = groupGaps([
      row({ id: "1", topic: "휴가 등록 절차" }),
      row({ id: "2", topic: "휴가 등록 절차" }),
      row({ id: "3", topic: "휴가 등록" }),
    ]);
    expect(g[0].topic).toBe("휴가 등록 절차");
  });
});
