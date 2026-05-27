import { describe, it, expect } from "vitest";
import {
  buildIncidentMailSubject,
  buildIncidentMailHtml,
  escapeHtml,
  type IncidentMailInput,
} from "../mail-template";

const baseInput: IncidentMailInput = {
  year: 2026,
  universityName: "한양대학교",
  appType: "공통원서",
  category: "결제 오류",
  title: "결제 페이지 문구 오안내",
  occurredDate: "2026-05-20",
  resolvedDate: "2026-05-21",
  causeSummary: "결제 페이지에서 안내 문구가 잘못 표기됨.",
  rootCause: "QA 단계 누락.",
  resolution: "문구 수정 + 핫픽스.",
  prevention: "QA 체크리스트 보강.",
  department: "운영부-운영1팀",
  assigneeName: "송영신",
  assigneeEmail: "ys1114@jinhakapply.com",
  reporterName: "허승철",
  reporterEmail: "alcure23@jinhakapply.com",
  status: "처리완료",
};

describe("buildIncidentMailSubject", () => {
  it("'[운영부 상황실]' prefix + 카테고리/대학명/제목 포함", () => {
    const subject = buildIncidentMailSubject(baseInput);
    expect(subject).toContain("[운영부 상황실]");
    expect(subject).toContain("결제 오류");
    expect(subject).toContain("한양대학교");
    expect(subject).toContain("결제 페이지 문구 오안내");
  });

  it("universityName이 null이면 대학명 미포함", () => {
    const subject = buildIncidentMailSubject({
      ...baseInput,
      universityName: null,
    });
    expect(subject).toContain("[운영부 상황실]");
    expect(subject).toContain("결제 페이지 문구 오안내");
    expect(subject).not.toContain("한양대학교");
  });
});

describe("buildIncidentMailHtml", () => {
  it("핵심 필드 모두 포함", () => {
    const html = buildIncidentMailHtml(baseInput);
    expect(html).toContain("결제 페이지 문구 오안내"); // 제목
    expect(html).toContain("결제 오류"); // 카테고리
    expect(html).toContain("공통원서"); // appType
    expect(html).toContain("한양대학교"); // 대학명
    expect(html).toContain("2026-05-20"); // occurred
    expect(html).toContain("2026-05-21"); // resolved
    expect(html).toContain("결제 페이지에서 안내 문구가 잘못 표기됨."); // 경위
    expect(html).toContain("QA 단계 누락."); // 원인
    expect(html).toContain("문구 수정 + 핫픽스."); // 처리
    expect(html).toContain("QA 체크리스트 보강."); // 대책
    expect(html).toContain("송영신"); // 담당자
    expect(html).toContain("허승철"); // 보고자
    expect(html).toContain("처리완료"); // 현재상황
    expect(html).toContain("운영부 상황실"); // 브랜드
  });

  it("작성 안 한 섹션은 '(작성된 내용 없음)' 플레이스홀더", () => {
    const html = buildIncidentMailHtml({
      ...baseInput,
      causeSummary: null,
      rootCause: null,
      resolution: null,
      prevention: null,
    });
    expect(html).toContain("(작성된 내용 없음)");
  });

  it("XSS escape — HTML 태그 raw로 안 들어감", () => {
    const html = buildIncidentMailHtml({
      ...baseInput,
      title: "<script>alert('x')</script>",
    });
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("escapeHtml", () => {
  it("HTML 특수문자 escape", () => {
    expect(escapeHtml("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(escapeHtml("a & b \"c\" 'd'")).toBe(
      "a &amp; b &quot;c&quot; &#39;d&#39;",
    );
  });
});
