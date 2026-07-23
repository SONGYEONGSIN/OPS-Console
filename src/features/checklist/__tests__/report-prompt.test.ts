import { describe, it, expect } from "vitest";
import { buildReportPrompt, extractReportHtml } from "../report-prompt";
import type { ChecklistRound, ChecklistItem } from "../schemas";

const round: ChecklistRound = {
  id: "r1",
  title: "2027학년도 수시모집",
  periodStart: "2026-07-27",
  periodEnd: "2026-09-11",
  status: "active",
  createdBy: "admin@x.com",
  createdAt: "2026-07-20T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
};
const items: ChecklistItem[] = [
  {
    id: "i1",
    roundId: "r1",
    department: "영업부",
    category: "매출",
    title: "접수건수 예측",
    status: "done",
    note: "<p>수시 합계 163만</p>",
    sortOrder: 0,
    attachments: [],
  },
  {
    id: "i2",
    roundId: "r1",
    department: "개발부",
    category: "",
    title: "원서작성 자동화",
    status: "in_progress",
    note: "마무리 단계",
    sortOrder: 0,
    attachments: [],
  },
];

describe("buildReportPrompt", () => {
  const p = buildReportPrompt(round, items);

  it("회차 제목·기간을 포함한다", () => {
    expect(p).toContain("2027학년도 수시모집");
    expect(p).toContain("2026-07-27");
    expect(p).toContain("2026-09-11");
  });

  it("작성된 부서(라벨)·항목·메모텍스트를 포함한다", () => {
    expect(p).toContain("영업"); // deptLabel(영업부)
    expect(p).toContain("개발"); // deptLabel(개발부)
    expect(p).toContain("접수건수 예측");
    expect(p).toContain("원서작성 자동화");
    expect(p).toContain("수시 합계 163만"); // note에서 태그 제거된 텍스트
    expect(p).toContain("마무리 단계");
  });

  it("상태 라벨을 서술 재료로 포함한다", () => {
    expect(p).toContain("완료");
    expect(p).toContain("진행중");
  });

  it("항목 없는 부서는 포함하지 않는다", () => {
    expect(p).not.toContain("고객지원"); // deptLabel(고객지원팀) — 항목 없음
  });

  it("HTML 출력 지침을 담는다", () => {
    expect(p).toContain("HTML");
    expect(p).toContain("<table>");
  });

  it("서술형+개조식 결합 지침을 담는다", () => {
    expect(p).toContain("서술"); // 도입 서술 문단
    expect(p).toContain("개조식"); // 세부 개조식
    expect(p).toContain("분류"); // 하위 불릿 '분류 : 내용' 형태
  });

  it("첨부 이미지 읽기 지침을 담는다", () => {
    expect(p).toContain("첨부 이미지");
  });

  it("제목틀 일관성(부서·카테고리 명칭 그대로) 지침을 담는다", () => {
    expect(p).toContain("그대로 사용");
  });

  it("수시 전용(정시 제외) + 접수건수표(진학사·유웨이·전문대 1·2차) 지침을 담는다", () => {
    expect(p).toContain("정시(정시모집)");
    expect(p).toContain("유웨이");
    expect(p).toContain("전문대 수시1차");
  });

  it("imagePaths 제공 시 해당 항목에 이미지 파일 경로를 참조한다", () => {
    const withImg: ChecklistItem = {
      ...items[0],
      note: '<p>접수 예측</p><img src="https://x/storage/v1/object/public/checklist/a.jpg">',
    };
    const p2 = buildReportPrompt(round, [withImg], {
      "https://x/storage/v1/object/public/checklist/a.jpg": "/tmp/a.jpg",
    });
    expect(p2).toContain("/tmp/a.jpg");
    expect(p2).toContain("접수 예측"); // 이미지 옆 텍스트도 유지
  });
});

describe("extractReportHtml", () => {
  it("```html 코드펜스를 벗겨낸다", () => {
    expect(extractReportHtml("```html\n<h2>요약</h2>\n```")).toBe(
      "<h2>요약</h2>",
    );
  });
  it("펜스 없는 HTML은 그대로(trim)", () => {
    expect(extractReportHtml("  <h2>x</h2>  ")).toBe("<h2>x</h2>");
  });
  it("첫 태그 앞 설명/뒤 잡텍스트를 제거한다", () => {
    expect(
      extractReportHtml("Here is the report:\n\n<h2>요약</h2><p>x</p>\n\n끝."),
    ).toBe("<h2>요약</h2><p>x</p>");
  });
});
