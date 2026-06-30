import { describe, it, expect } from "vitest";
import { buildEditorRow } from "../build-editor-row";
import type { ServiceLite } from "@/features/handover/queries";
import type { HandoverRecordRow } from "@/features/handover/schemas";

const service: ServiceLite = {
  id: "svc-uuid",
  service_id: 1098001,
  university_name: "숙명여자대학교",
  service_name: "Fall Admission",
  application_type: "반응형원서",
  operator_name: "송영신",
};

describe("buildEditorRow", () => {
  it("record 없으면 id·기본정보만, handover 필드는 비어있음", () => {
    const row = buildEditorRow(service, null, []);
    expect(row.id).toBe("svc-uuid");
    expect(row.universityName).toBe("숙명여자대학교");
    expect(row.handoverStatus).toBeUndefined();
    expect(row.handoverContractInfoMd ?? null).toBeNull();
    expect(row.handoverContractChecklist).toEqual([]);
  });

  it("record 있으면 14필드 매핑 + status 반영", () => {
    const record = {
      id: "rec-uuid",
      service_id: "svc-uuid",
      contract_info_md: "계약메모",
      contract_info: {
        title: "A",
        type: "",
        progress: "",
        status: "",
        memo: "",
      },
      contract_data_md: null,
      contract_data_checklist: [{ id: "a", text: "항목", done: false }],
      work_basic_md: "기초",
      work_generator_md: null,
      work_site_md: null,
      work_output_md: null,
      work_rate_md: null,
      work_file_md: null,
      work_etc_md: null,
      payment_fee_md: null,
      payment_invoice_md: null,
      payment_fee: { deadline: "", manager: "", memo: "" },
      payment_invoice: { issueType: "", memo: "" },
      school_contact_md: null,
      school_contacts: [],
      docs_md: null,
      docs_checklist: [],
      notes_md: "특이",
      author_email: "a@b.com",
      author_name: "송영신",
      status: "draft",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    } as HandoverRecordRow;
    const row = buildEditorRow(service, record, []);
    expect(row.handoverContractInfoMd).toBe("계약메모");
    expect(row.handoverContractInfo?.title).toBe("A");
    expect(row.handoverWorkBasicMd).toBe("기초");
    expect(row.handoverNotesMd).toBe("특이");
    expect(row.handoverStatus).toBe("draft");
    expect(row.handoverContractChecklist).toHaveLength(1);
  });

  it("연락처 후보 부착", () => {
    const row = buildEditorRow(service, null, [
      {
        name: "홍길동",
        jobTitle: "팀장",
        phone: "010",
        ext: "1234",
        email: "x@y.z",
      },
    ]);
    expect(row.handoverSchoolContactCandidates).toHaveLength(1);
    expect(row.handoverSchoolContactCandidates?.[0]?.name).toBe("홍길동");
    expect(row.handoverSchoolContactCandidates?.[0]?.ext).toBe("1234");
  });
});
