import { describe, it, expect } from "vitest";
import { buildDefaultDataRequestText } from "../mail-template";

describe("buildDefaultDataRequestText", () => {
  it("제목에 브랜드 + 대학명 + 서비스명 포함, 본문에 인사·요청항목·일정 포함", () => {
    const { subject, body } = buildDefaultDataRequestText({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "2025.05.11",
      writeEnd: "2025.06.02",
    });
    expect(subject).toContain("[진학어플라이]");
    expect(subject).toContain("조선대학교");
    expect(subject).toContain("수시모집");
    expect(body).toContain("진학어플라이 송영신입니다");
    expect(body).toContain("[요청 항목]");
    expect(body).toContain("모집요강");
    expect(body).toContain("(작년 일정 : 2025.05.11 ~ 2025.06.02)");
  });

  it("일정이 비어있으면 작년 일정 라인 생략", () => {
    const { body } = buildDefaultDataRequestText({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "",
      writeEnd: "",
    });
    expect(body).not.toContain("작년 일정");
  });
});
