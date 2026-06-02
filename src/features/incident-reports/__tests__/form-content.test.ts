import { describe, it, expect } from "vitest";
import {
  deriveFormModel,
  greeting,
  jeonkyeolDate,
  DEFAULT_APOLOGY,
  type FormSource,
} from "../form-content";

const base: FormSource = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2026-06-02",
  authorName: "이해영",
  approverName: "송영신",
  directorName: null,
  ceoName: null,
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용",
  cause: "원인 내용",
  handling: "처리 내용",
  prevention: "대책 내용",
};

describe("greeting", () => {
  it("대학명을 인사말에 삽입한다", () => {
    expect(greeting("건국대학교")).toBe("건국대학교의 무궁한 발전을 기원합니다.");
  });
});

describe("jeonkyeolDate", () => {
  it("YYYY-MM-DD를 MM/DD로 변환한다", () => {
    expect(jeonkyeolDate("2026-06-02")).toBe("06/02");
  });
  it("'YYYY. MM. DD' 형식도 변환한다", () => {
    expect(jeonkyeolDate("2025. 02. 13")).toBe("02/13");
  });
  it("숫자 그룹이 3개 미만이면 빈 문자열을 반환한다", () => {
    expect(jeonkyeolDate("2026")).toBe("");
  });
});

describe("deriveFormModel", () => {
  it("apology가 null이면 기본 문구를 쓴다", () => {
    expect(deriveFormModel(base).apology).toBe(DEFAULT_APOLOGY);
  });
  it("apology 입력이 있으면 그 값을 우선한다", () => {
    expect(deriveFormModel({ ...base, apology: "직접 사과문" }).apology).toBe(
      "직접 사과문",
    );
  });
  it("apology가 공백만 있으면 기본 문구로 대체한다", () => {
    expect(deriveFormModel({ ...base, apology: "   " }).apology).toBe(
      DEFAULT_APOLOGY,
    );
  });
  it("4섹션을 번호·라벨·본문으로 만든다", () => {
    const m = deriveFormModel(base);
    expect(m.sections).toHaveLength(4);
    expect(m.sections[0]).toEqual({ no: 1, label: "경위", body: "경위 내용" });
    expect(m.sections[3].label).toBe("향후 대책");
  });
  it("결재라인 4칸을 채운다(빈 값은 빈 문자열)", () => {
    const m = deriveFormModel(base);
    expect(m.approvalLine).toEqual([
      { role: "담당자", name: "이해영" },
      { role: "팀장", name: "송영신" },
      { role: "본부장", name: "" },
      { role: "사장", name: "" },
    ]);
  });
  it("붙임 라인에 제목을 넣는다", () => {
    expect(deriveFormModel(base).attachment).toBe(
      "붙임 : 1. 전산파일 오류 건 경위서 1부.  끝.",
    );
  });
});
