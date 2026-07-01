import { describe, it, expect } from "vitest";
import {
  buildHandoverHtmlDocument,
  type HandoverHtmlInput,
} from "../html-document";
import { HANDOVER_FIELD_KEYS, type HandoverFieldKey } from "../categories";

const emptyFields = Object.fromEntries(
  HANDOVER_FIELD_KEYS.map((k) => [k, null]),
) as Record<HandoverFieldKey, string | null>;

const base: HandoverHtmlInput = {
  universityName: "부산대학교",
  serviceName: "수시",
  applicationType: "공통원서",
  fromName: "송영신",
  fromEmail: "from@x.com",
  toName: "테스트1",
  toEmail: "to@x.com",
  notes: null,
  createdAt: "2026-07-01T00:00:00Z",
  fields: emptyFields,
  contractInfo: { title: "", type: "", progress: "", status: "", memo: "" },
  contractChecklist: [],
  docsChecklist: [],
  schoolContacts: [],
  paymentFee: { deadline: "", manager: "", memo: "" },
  paymentInvoice: { issueType: "", memo: "" },
};

describe("handover html document (attachment)", () => {
  it("문서 골격 + 제목/메타/브랜드", () => {
    const h = buildHandoverHtmlDocument(base);
    expect(h).toContain("<!DOCTYPE html>");
    expect(h).toContain("인수인계 확인서");
    expect(h).toContain("운영부 상황실 · 인수인계");
    expect(h).toContain("부산대학교");
    expect(h).toContain("수시");
    expect(h).toContain("공통원서");
    expect(h).toContain("송영신");
    expect(h).toContain("테스트1");
  });

  it("목차 6개 카테고리 + 진행률(N / 6)", () => {
    const h = buildHandoverHtmlDocument(base);
    for (const label of ["계약", "작업", "정산", "컨텍", "서류", "기타"]) {
      expect(h).toContain(label);
    }
    expect(h).toContain("/ 6");
  });

  it("첨부 문서는 배경 밴드(clean-v2) 사용 — 메일 본문과 달리 배경색 허용", () => {
    const h = buildHandoverHtmlDocument(base);
    expect(h).toContain("#b8331e");
  });

  it("구조화 필드 렌더 + URL 링크 + 빈 필드 (미작성)", () => {
    const h = buildHandoverHtmlDocument({
      ...base,
      contractInfo: {
        title: "원서접수 대행",
        type: "",
        progress: "",
        status: "",
        memo: "참고 https://jinhaksa.sharepoint.com/x",
      },
    });
    expect(h).toContain("원서접수 대행");
    expect(h).toContain('<a href="https://jinhaksa.sharepoint.com/x"');
    expect(h).toContain("(미작성)");
  });

  it("notes 있으면 인계 메모, 없으면 미표시", () => {
    expect(buildHandoverHtmlDocument({ ...base, notes: "메모O" })).toContain(
      "메모O",
    );
    expect(buildHandoverHtmlDocument({ ...base, notes: null })).not.toContain(
      "인계 메모",
    );
  });

  it("목차 클릭 시 해당 섹션으로 이동 — 앵커 링크 + 섹션 id", () => {
    const h = buildHandoverHtmlDocument(base);
    expect(h).toContain('href="#sec-contract"');
    expect(h).toContain('id="sec-contract"');
    expect(h).toContain('href="#sec-etc"');
    expect(h).toContain('id="sec-etc"');
  });

  it("메타 서비스 값 — 대학명 강조(pri) + 접수구분·서비스명 연하게(dim)", () => {
    const h = buildHandoverHtmlDocument(base);
    expect(h).toContain('<span class="pri">부산대학교</span>');
    expect(h).toContain('<span class="dim">공통원서</span>');
    expect(h).toContain('<span class="dim">수시</span>');
  });

  it("다중행 필드 — 들여쓰기/줄바꿈 보존(<br> 미사용, pre-wrap)", () => {
    const h = buildHandoverHtmlDocument({
      ...base,
      fields: { ...base.fields, work_basic_md: "1줄\n    들여쓴 2줄" },
    });
    expect(h).toContain("white-space:pre-wrap");
    expect(h).not.toContain("<br>");
    expect(h).toContain("1줄\n    들여쓴 2줄");
  });

  it("XSS escape", () => {
    const h = buildHandoverHtmlDocument({
      ...base,
      universityName: "<script>alert(1)</script>",
    });
    expect(h).not.toContain("<script>alert");
    expect(h).toContain("&lt;script&gt;");
  });
});
