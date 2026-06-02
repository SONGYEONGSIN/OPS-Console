import { describe, it, expect } from "vitest";
import {
  deriveFormModel,
  jeonkyeolDate,
  type FormSource,
} from "../form-content";
import { defaultApology } from "../apology";

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
  it("apology가 null이면 defaultApology(대학명)을 쓴다 (인사말 포함)", () => {
    const m = deriveFormModel(base);
    expect(m.apology).toBe(defaultApology("건국대학교"));
    expect(m.apology).toContain("건국대학교의 무궁한 발전을 기원합니다.");
  });
  it("apology 입력이 있으면 그 값을 우선한다", () => {
    expect(deriveFormModel({ ...base, apology: "직접 사과문" }).apology).toBe(
      "직접 사과문",
    );
  });
  it("apology가 공백만 있으면 기본 문구로 대체한다", () => {
    expect(deriveFormModel({ ...base, apology: "   " }).apology).toBe(
      defaultApology("건국대학교"),
    );
  });
  it("greeting을 별도 필드로 노출하지 않는다 (apology 단일 소스)", () => {
    expect("greeting" in deriveFormModel(base)).toBe(false);
  });
  it("4섹션을 번호·라벨·본문으로 만든다", () => {
    const m = deriveFormModel(base);
    expect(m.sections).toHaveLength(4);
    expect(m.sections[0]).toEqual({ no: 1, label: "경위", body: "경위 내용" });
    expect(m.sections[3].label).toBe("향후 대책");
  });
  it("결재라인 4칸을 채운다(빈 값은 빈 문자열)", () => {
    expect(deriveFormModel(base).approvalLine).toEqual([
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
