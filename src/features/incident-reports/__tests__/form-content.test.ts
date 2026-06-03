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
  authorEmail: "haelee@jinhakapply.com",
  approverName: "송영신",
  approverRole: "팀장",
  directorName: null,
  directorRole: null,
  ceoName: null,
  ceoRole: null,
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용",
  cause: "원인 내용",
  handling: "처리 내용",
  handlingRows: [],
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
  it("결재라인 4칸을 채운다(빈 값은 빈 문자열, 직책 폴백)", () => {
    expect(deriveFormModel(base).approvalLine).toEqual([
      { role: "담당자", name: "이해영" },
      { role: "팀장", name: "송영신" },
      { role: "본부장", name: "" },
      { role: "사장", name: "" },
    ]);
  });
  it("작성자가 팀장(기안자=결재팀장)이면 담당자 칸을 생략한다", () => {
    const m = deriveFormModel({
      ...base,
      authorName: "송영신",
      approverName: "송영신",
      approverRole: "팀장",
    });
    expect(m.approvalLine.map((a) => a.role)).toEqual(["팀장", "본부장", "사장"]);
    expect(m.approvalLine.some((a) => a.role === "담당자")).toBe(false);
  });
  it("저장된 실제 직책이 있으면 그 직책으로 결재라인 라벨을 표시한다", () => {
    const m = deriveFormModel({
      ...base,
      approverRole: "팀장",
      directorName: "이정일",
      directorRole: "부장",
      ceoName: "주정현",
      ceoRole: "부사장",
    });
    expect(m.approvalLine).toEqual([
      { role: "담당자", name: "이해영" },
      { role: "팀장", name: "송영신" },
      { role: "부장", name: "이정일" },
      { role: "부사장", name: "주정현" },
    ]);
  });
  it("붙임 라인에 제목을 넣는다", () => {
    expect(deriveFormModel(base).attachment).toBe(
      "붙임 : 1. 전산파일 오류 건 경위서 1부.  끝.",
    );
  });
  it("공문 본문(coverBody)을 [인사말, 사과본문, 감사합니다] 3항목으로 만든다", () => {
    const m = deriveFormModel({
      ...base,
      apology:
        "건국대학교의 무궁한 발전을 기원합니다.\n\n당사는 오류로 사과드립니다. 감사합니다.",
    });
    expect(m.coverBody).toHaveLength(3);
    expect(m.coverBody[0]).toBe("건국대학교의 무궁한 발전을 기원합니다.");
    expect(m.coverBody[1]).toBe("당사는 오류로 사과드립니다.");
    expect(m.coverBody[2]).toBe("감사합니다.");
  });
  it("작성일자/접수일자를 'YYYY. MM. DD'로 포맷한다", () => {
    const m = deriveFormModel(base);
    expect(m.draftDate).toBe("2026. 06. 02");
    expect(m.receiptDate).toBe("2026. 06. 02");
  });
  it("연락처 줄에 작성자 이메일을 넣는다", () => {
    const lines = deriveFormModel(base).contactLines;
    expect(lines.some((l) => l.includes("haelee@jinhakapply.com"))).toBe(true);
  });
  it("처리 섹션(3)에 handlingRows를 표 데이터로 싣는다", () => {
    const rows = [{ time: "10:00", content: "조치1" }];
    const m = deriveFormModel({ ...base, handlingRows: rows });
    const handling = m.sections.find((s) => s.no === 3);
    expect(handling?.rows).toEqual(rows);
  });
  it("handlingRows가 비면 처리 섹션 rows는 빈 배열(폴백 text)", () => {
    const handling = deriveFormModel(base).sections.find((s) => s.no === 3);
    expect(handling?.rows).toEqual([]);
    expect(handling?.body).toBe("처리 내용");
  });
});
