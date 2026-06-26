import { describe, it, expect } from "vitest";
import {
  isHandoverFieldComplete,
  isHandoverRecordComplete,
} from "../completion";

// 14필드 전부 채운 완전 레코드 (구조화 필드는 구조화 데이터로 충족)
function fullRecord() {
  return {
    contract_info: {
      title: "원서접수",
      type: "수의",
      progress: "",
      status: "",
      memo: "",
    },
    contract_data_md: "계약자료",
    contract_data_checklist: [],
    work_basic_md: "기본",
    work_generator_md: "생성기",
    work_site_md: "사이트",
    work_output_md: "산출",
    work_rate_md: "노임",
    work_file_md: "파일",
    work_etc_md: "기타",
    payment_fee: { deadline: "월말", manager: "", memo: "" },
    payment_invoice: { issueType: "역발행", memo: "" },
    payment_fee_md: "",
    payment_invoice_md: "",
    contract_info_md: "",
    school_contact_md: "",
    school_contacts: [{ id: "1", name: "홍길동" }],
    docs_md: "서류",
    docs_checklist: [],
    notes_md: "메모",
  };
}

describe("isHandoverFieldComplete — 구조화 필드는 구조화 데이터로 판정", () => {
  it("contract_info_md: 구조화 contract_info에 값 있으면 완료(원문 md 비어도)", () => {
    const d = { contract_info: { title: "원서접수" }, contract_info_md: "" };
    expect(isHandoverFieldComplete(d, "contract_info_md")).toBe(true);
  });
  it("payment_fee_md: payment_fee.deadline/memo 있으면 완료", () => {
    expect(
      isHandoverFieldComplete(
        { payment_fee: { memo: "처리" } },
        "payment_fee_md",
      ),
    ).toBe(true);
  });
  it("payment_invoice_md: payment_invoice.issueType 있으면 완료", () => {
    expect(
      isHandoverFieldComplete(
        { payment_invoice: { issueType: "역발행" } },
        "payment_invoice_md",
      ),
    ).toBe(true);
  });
  it("school_contact_md: school_contacts 1건 이상이면 완료", () => {
    expect(
      isHandoverFieldComplete(
        { school_contacts: [{ id: "1", name: "김" }] },
        "school_contact_md",
      ),
    ).toBe(true);
  });
  it("구조화/원문 모두 비면 미완료", () => {
    expect(
      isHandoverFieldComplete({ contract_info: {} }, "contract_info_md"),
    ).toBe(false);
    expect(isHandoverFieldComplete({ payment_fee: {} }, "payment_fee_md")).toBe(
      false,
    );
    expect(
      isHandoverFieldComplete({ school_contacts: [] }, "school_contact_md"),
    ).toBe(false);
  });
  it("일반 md 필드는 텍스트 유무로 판정", () => {
    expect(
      isHandoverFieldComplete({ work_basic_md: "내용" }, "work_basic_md"),
    ).toBe(true);
    expect(
      isHandoverFieldComplete({ work_basic_md: "  " }, "work_basic_md"),
    ).toBe(false);
  });
});

describe("isHandoverRecordComplete", () => {
  it("14필드 충족(구조화 포함) → true", () => {
    expect(isHandoverRecordComplete(fullRecord())).toBe(true);
  });
  it("구조화 필드 하나라도 비면 false", () => {
    const d = fullRecord();
    d.school_contacts = [];
    expect(isHandoverRecordComplete(d)).toBe(false);
  });
});
