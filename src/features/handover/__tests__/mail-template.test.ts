import { describe, it, expect } from "vitest";
import {
  buildHandoverMailSubject,
  buildHandoverMailHtml,
  type HandoverMailContent,
} from "../mail-template";
import { HANDOVER_FIELD_KEYS, type HandoverFieldKey } from "../categories";

const emptyFields = Object.fromEntries(
  HANDOVER_FIELD_KEYS.map((k) => [k, null]),
) as Record<HandoverFieldKey, string | null>;

const content: HandoverMailContent = {
  fields: emptyFields,
  contractInfo: { title: "", type: "", progress: "", status: "", memo: "" },
  contractChecklist: [],
  docsChecklist: [],
  schoolContacts: [],
  paymentFee: { deadline: "", manager: "", memo: "" },
  paymentInvoice: { issueType: "", memo: "" },
};

const base = {
  universityName: "한예종",
  serviceName: "KARTS",
  applicationType: "공통원서",
  fromName: "허승철",
  fromEmail: "from@x.com",
  toName: "송영신",
  toEmail: "to@x.com",
  notes: null as string | null,
  historyUrl: "https://x",
  ...content,
};

describe("handover mail template", () => {
  it("subject — '[운영부 상황실]' 브랜드 + 대학명·서비스명 + '인수인계 요청'", () => {
    const s = buildHandoverMailSubject({
      universityName: "한예종",
      serviceName: "KARTS",
    });
    expect(s).toContain("[운영부 상황실]");
    expect(s).toContain("한예종");
    expect(s).toContain("KARTS");
    expect(s).toContain("인수인계 요청");
    expect(s).not.toContain("Folio");
    expect(s).not.toContain("TEST");
  });

  it("html — 인계자/인수자/서비스/메모 모두 표시 + 안내 문구", () => {
    const h = buildHandoverMailHtml({
      ...base,
      notes: "참고할 점 있음",
      historyUrl: "https://folio.local/dashboard/handover?tab=history",
    });
    expect(h).toContain("한예종");
    expect(h).toContain("KARTS");
    expect(h).toContain("허승철");
    expect(h).toContain("송영신");
    expect(h).toContain("참고할 점 있음");
    expect(h).toContain("folio.local/dashboard/handover?tab=history");
  });

  it("html — notes 없으면 메모 섹션 미표시", () => {
    const h = buildHandoverMailHtml({ ...base, notes: null });
    expect(h).not.toContain("인계 메모");
  });

  it("html — 본문에는 상세 인수인계 내용(details) 미포함 — 첨부 HTML로 대체", () => {
    const h = buildHandoverMailHtml({
      ...base,
      contractInfo: {
        title: "원서접수 대행",
        type: "",
        progress: "",
        status: "",
        memo: "",
      },
    });
    expect(h).not.toContain("<details");
    expect(h).not.toContain("원서접수 대행");
    expect(h).toContain("첨부된 HTML 파일");
  });

  it("html — 브랜딩 통일: 헤더/푸터 + 'Folio'/'TEST'/'테스트' 부재", () => {
    const h = buildHandoverMailHtml(base);
    expect(h).toContain("운영부 상황실 · 인수인계");
    expect(h).toContain("운영부 상황실 자동발송");
    expect(h).not.toContain("FOLIO");
    expect(h).not.toContain("Folio");
    expect(h).not.toMatch(/테스트/);
    expect(h).not.toMatch(/TEST/);
  });

  it("html — 배경색(background:#xxx) 미포함 — 메일 클라이언트 기본 테마 사용", () => {
    const h = buildHandoverMailHtml({ ...base, notes: "메모 있음" });
    expect(h).not.toMatch(/background\s*:\s*#[0-9a-fA-F]{3,8}/);
    expect(h).not.toMatch(/background-color\s*:\s*#[0-9a-fA-F]{3,8}/);
  });

  it("html — XSS 방지 escape", () => {
    const h = buildHandoverMailHtml({
      ...base,
      universityName: "<script>alert(1)</script>",
    });
    expect(h).not.toContain("<script>alert");
    expect(h).toContain("&lt;script&gt;");
  });
});
