import { describe, it, expect } from "vitest";
import {
  deriveFormModel,
  jeonkyeolDate,
  bodyLines,
  type FormSource,
} from "../form-content";
import { defaultApology } from "../apology";

describe("bodyLines", () => {
  it("'-'로 시작하는 줄은 들여쓰기(indent=true)로 표시한다", () => {
    expect(bodyLines("1) 항목\n- 세부\n2) 항목2")).toEqual([
      { text: "1) 항목", indent: false },
      { text: "- 세부", indent: true },
      { text: "2) 항목2", indent: false },
    ]);
  });
  it("앞에 공백이 있어도 '-'로 시작하면 들여쓴다", () => {
    expect(bodyLines("  - 들여쓴 대시")[0].indent).toBe(true);
  });
  it("빈 문자열은 빈 줄 1개를 반환한다", () => {
    expect(bodyLines("")).toEqual([{ text: "", indent: false }]);
  });
  it("문장 미완(마침표 없는) 줄 뒤의 비목록 줄은 이어붙여 소프트 줄바꿈을 복원한다", () => {
    const r = bodyLines(
      "대학에서 전산 자료를 내려받기\n전에 전산파일을 검수하겠습니다.",
    );
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe(
      "대학에서 전산 자료를 내려받기 전에 전산파일을 검수하겠습니다.",
    );
  });
  it("마침표로 끝난 줄 다음은 합치지 않는다(문단 유지)", () => {
    expect(bodyLines("검수하겠습니다.\n또한, 추가로 보겠습니다.")).toHaveLength(
      2,
    );
  });
  it("목록 항목(- / 숫자))은 앞 줄과 합치지 않고 새 줄로 유지한다", () => {
    expect(bodyLines("1) 종목 코드\n- 세부 항목")).toHaveLength(2);
    expect(bodyLines("종목 코드\n2) 다음 항목")).toHaveLength(2);
  });
});

const base: FormSource = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2026-06-02",
  authorName: "이해영",
  authorEmail: "haelee@jinhakapply.com",
  authorPhone: null,
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
    expect(m.approvalLine.map((a) => a.role)).toEqual([
      "팀장",
      "본부장",
      "사장",
    ]);
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
  it("greeting 입력이 있으면 1번(coverBody[0])에 그 값을 쓴다", () => {
    const m = deriveFormModel({
      ...base,
      greeting: "안녕하십니까. 맞춤 인사말.",
    });
    expect(m.coverBody[0]).toBe("안녕하십니까. 맞춤 인사말.");
  });
  it("greeting이 없으면 수신대학 기반 자동 인사말을 쓴다", () => {
    expect(deriveFormModel(base).coverBody[0]).toBe(
      "건국대학교의 무궁한 발전을 기원합니다.",
    );
  });
  it("greeting이 공백만이면 자동 인사말로 폴백한다", () => {
    expect(deriveFormModel({ ...base, greeting: "   " }).coverBody[0]).toBe(
      "건국대학교의 무궁한 발전을 기원합니다.",
    );
  });
  it("closing 입력이 있으면 3번(coverBody[2])에 그 값을 쓴다", () => {
    const m = deriveFormModel({ ...base, closing: "끝까지 감사드립니다." });
    expect(m.coverBody[2]).toBe("끝까지 감사드립니다.");
  });
  it("closing이 없으면 '감사합니다.'로 폴백한다", () => {
    expect(deriveFormModel(base).coverBody[2]).toBe("감사합니다.");
  });
  it("발번 전(docNumber 없음): 시행·전결 일자는 작성일 폴백", () => {
    const m = deriveFormModel(base);
    expect(m.draftDate).toBe("2026. 06. 02");
    expect(m.receiptDate).toBe("2026. 06. 02");
    expect(m.jeonkyeolDate).toBe("06/02");
  });
  it("발번 후(docNumber 있음): 시행(접수)·전결은 발번일, 작성일자는 작성일 유지", () => {
    // 운영2606-1001 = 2026-06-10 발번
    const m = deriveFormModel({ ...base, docNumber: "운영2606-1001" });
    expect(m.draftDate).toBe("2026. 06. 02"); // 작성일자는 그대로
    expect(m.receiptDate).toBe("2026. 06. 10"); // 시행번호 괄호 = 발번일
    expect(m.jeonkyeolDate).toBe("06/10"); // 전결 = 발번일
  });
  it("연락처 줄에 작성자 이메일을 넣는다", () => {
    const lines = deriveFormModel(base).contactLines;
    expect(lines.some((l) => l.includes("haelee@jinhakapply.com"))).toBe(true);
  });
  it("authorPhone이 있으면 연락처 전화에 담당자 번호를 넣는다", () => {
    const lines = deriveFormModel({
      ...base,
      authorPhone: "(02)2013-1234",
    }).contactLines;
    expect(lines.some((l) => l.includes("(02)2013-1234"))).toBe(true);
    expect(lines.some((l) => l.includes("(02)2013-0669"))).toBe(false);
  });
  it("authorPhone이 없으면 대표번호로 폴백한다", () => {
    const lines = deriveFormModel(base).contactLines;
    expect(lines.some((l) => l.includes("(02)2013-0669"))).toBe(true);
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
