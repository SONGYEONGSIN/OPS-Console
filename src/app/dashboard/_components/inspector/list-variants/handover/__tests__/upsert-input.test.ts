import { describe, it, expect } from "vitest";
import { buildHandoverUpsertInput } from "../upsert-input";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "서울대 · 수시",
  status: "active",
  owner: "송영신",
  handoverContractDataMd: "메모",
  handoverContractChecklist: [
    { id: "a", text: "항목1", done: false },
    { id: "b", text: "   ", done: false },
  ],
  handoverSchoolContacts: [
    {
      id: "c",
      name: "홍길동",
      jobTitle: null,
      phone: null,
      ext: null,
      email: null,
    },
    {
      id: "d",
      name: "  ",
      jobTitle: null,
      phone: null,
      ext: null,
      email: null,
    },
  ],
  handoverNotesMd: "특이사항",
};

describe("buildHandoverUpsertInput", () => {
  it("service_id는 row.id로 매핑", () => {
    expect(buildHandoverUpsertInput(row).service_id).toBe(row.id);
  });

  it("빈 텍스트 체크리스트 항목은 제외", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.contract_data_checklist).toHaveLength(1);
    expect(out.contract_data_checklist[0]?.text).toBe("항목1");
  });

  it("이름 없는 연락처 항목은 제외", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.school_contacts).toHaveLength(1);
    expect(out.school_contacts[0]?.name).toBe("홍길동");
  });

  it("구조화 필드 미지정 시 기본값 채움", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.contract_info).toEqual({
      title: "",
      type: "",
      progress: "",
      status: "",
      memo: "",
    });
    expect(out.payment_fee).toEqual({ deadline: "", manager: "", memo: "" });
    expect(out.payment_invoice).toEqual({ issueType: "", memo: "" });
  });

  it("md 필드 미지정 시 null", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.work_basic_md).toBeNull();
    expect(out.notes_md).toBe("특이사항");
  });
});
