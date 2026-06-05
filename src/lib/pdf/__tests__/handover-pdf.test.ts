import { describe, it, expect } from "vitest";
import { renderHandoverPdf } from "../handover-pdf";

describe("renderHandoverPdf", () => {
  it("buffer 반환 (PDF 시그너처 %PDF-)", async () => {
    const buf = await renderHandoverPdf({
      universityName: "한예종",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: "참고 메모",
      createdAt: "2026-05-17T00:00:00Z",
      docsChecklist: [
        { text: "사업자등록증", done: true },
        { text: "통장사본", done: false },
      ],
      fields: {
        contract_info_md: "원서접수",
        contract_data_md: null,
        work_basic_md: "기초",
        work_generator_md: null,
        work_site_md: null,
        work_output_md: null,
        work_rate_md: null,
        work_file_md: null,
        work_etc_md: null,
        payment_fee_md: null,
        payment_invoice_md: null,
        school_contact_md: "담당자 010-1234-5678",
        docs_md: null,
        notes_md: null,
      },
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString("utf8").startsWith("%PDF-")).toBe(true);
  });
});
