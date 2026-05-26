import { describe, it, expect } from "vitest";
import {
  backupRequestCreateSchema,
  backupRequestRowSchema,
  serviceDetailSchema,
  MAIL_STATUS_VALUES,
} from "../schemas";

// PR-5: contacts는 {contact_id, customer_name, university_name, email, phone}[] 객체 배열.
// 이전 string[] 라벨 형식은 PR-4까지 사용. PR-5에서 메일/PDF에 이메일/전화 노출 위해 객체화.
const baseInput = {
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: [
    { service_id: "11111111-1111-4111-8111-111111111111" },
    { service_id: "22222222-2222-4222-8222-222222222222" },
  ],
  summary_md: "백업 요청 내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  requester_email: "bob@example.com",
};

describe("backupRequestCreateSchema", () => {
  it("정상 입력 통과 (services 튜플 배열, substitute 미지정 default fallback)", () => {
    const r = backupRequestCreateSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
  });

  it("PR-3: 서비스별 substitute_email 명시 지정 통과", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [
        {
          service_id: "11111111-1111-4111-8111-111111111111",
          substitute_email: "x@example.com",
          substitute_name: "X",
        },
        {
          service_id: "22222222-2222-4222-8222-222222222222",
          substitute_email: "y@example.com",
          substitute_name: "Y",
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("PR-5: 서비스에 contacts 객체 배열/note_md 동반 → parse 후 보존", () => {
    const contacts = [
      {
        contact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        customer_name: "양라윤",
        university_name: "연세대",
        email: "yry@yonsei.ac.kr",
        phone: "010-1111-2222",
      },
      {
        contact_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        customer_name: "홍길동",
        university_name: "고려대",
        email: null,
        phone: null,
      },
    ];
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [
        {
          service_id: "11111111-1111-4111-8111-111111111111",
          contacts,
          note_md: "5/20 마감 임박. 양식 첨부",
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.services[0]?.contacts).toEqual(contacts);
      expect(r.data.services[0]?.note_md).toBe("5/20 마감 임박. 양식 첨부");
    }
  });

  it("PR-5: 서비스에 contacts/note_md 미동반 → contacts 빈 배열 default, note_md undefined", () => {
    const r = backupRequestCreateSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.services[0]?.contacts).toEqual([]);
      expect(r.data.services[0]?.note_md).toBeUndefined();
    }
  });

  it("PR-5: 서비스의 contacts 20개 초과 거부", () => {
    const tooManyContacts = Array.from({ length: 21 }, (_, i) => ({
      contact_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customer_name: `c${i}`,
      university_name: "X대",
      email: null,
      phone: null,
    }));
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [
        {
          service_id: "11111111-1111-4111-8111-111111111111",
          contacts: tooManyContacts,
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("uuid 형식이 아닌 service_id 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [{ service_id: "not-a-uuid" }],
    });
    expect(r.success).toBe(false);
  });

  it("빈 summary 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      summary_md: "",
    });
    expect(r.success).toBe(false);
  });

  it("self (substitute == requester) 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      substitute_email: baseInput.requester_email,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("백업자");
    }
  });

  it("end < start 거부", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      leave_start_date: "2026-05-25",
      leave_end_date: "2026-05-20",
    });
    expect(r.success).toBe(false);
  });

  it("빈 services 허용", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: [],
    });
    expect(r.success).toBe(true);
  });

  it("leave 날짜 둘 다 미입력 허용 (전사 휴가 외 케이스)", () => {
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      leave_start_date: null,
      leave_end_date: null,
    });
    expect(r.success).toBe(true);
  });

  it("services max 20 초과 거부", () => {
    const tooMany = Array.from({ length: 21 }, () => ({
      service_id: "11111111-1111-4111-8111-111111111111",
    }));
    const r = backupRequestCreateSchema.safeParse({
      ...baseInput,
      services: tooMany,
    });
    expect(r.success).toBe(false);
  });
});

describe("serviceDetailSchema", () => {
  it("정상 join row 파싱 (contacts 빈 배열 default, note_md nullable)", () => {
    const r = serviceDetailSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: 5072006,
      service_name: "Graduate School of Police Studies",
      university_name: "경찰대학 대학원",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contacts).toEqual([]);
      expect(r.data.note_md).toBeNull();
    }
  });

  it("PR-5: contacts 객체 배열/note_md 포함 join row 보존", () => {
    const contacts = [
      {
        contact_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        customer_name: "강민호",
        university_name: "경찰대",
        email: "kmh@police.ac.kr",
        phone: "010-3333-4444",
      },
    ];
    const r = serviceDetailSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: 5072006,
      service_name: "신입학",
      university_name: "경찰대학",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      contacts,
      note_md: "5/20 마감",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contacts).toEqual(contacts);
      expect(r.data.note_md).toBe("5/20 마감");
    }
  });

  it("service_id 음수 거부", () => {
    const r = serviceDetailSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: -1,
      service_name: "x",
      university_name: "y",
    });
    expect(r.success).toBe(false);
  });
});

describe("backupRequestRowSchema", () => {
  it("PR-5: DB row 파싱 (contacts 객체 배열)", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      requester_email: "bob@example.com",
      requester_team: "ops",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      services_detail: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          service_id: 5072006,
          service_name: "Graduate School of Police Studies",
          university_name: "경찰대학 대학원",
          contacts: [
            {
              contact_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              customer_name: "강민호",
              university_name: "경찰대학",
              email: "kmh@police.ac.kr",
              phone: "010-3333-4444",
            },
          ],
          note_md: "디테일",
        },
      ],
      summary_md: "내용",
      leave_start_date: "2026-05-20",
      leave_end_date: "2026-05-25",
      mail_status: "pending",
      mail_sent_at: null,
      mail_error: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    };
    const r = backupRequestRowSchema.safeParse(row);
    expect(r.success).toBe(true);
  });

  it("services_detail 누락 시 빈 배열 default", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      requester_email: "bob@example.com",
      requester_team: "ops",
      substitute_email: "alice@example.com",
      substitute_name: "Alice",
      summary_md: "내용",
      leave_start_date: null,
      leave_end_date: null,
      mail_status: "pending",
      mail_sent_at: null,
      mail_error: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    };
    const r = backupRequestRowSchema.safeParse(row);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.services_detail).toEqual([]);
    }
  });
});

describe("MAIL_STATUS_VALUES", () => {
  it("4가지 상태 포함", () => {
    expect(MAIL_STATUS_VALUES).toEqual([
      "pending",
      "sent",
      "mail_failed",
      "dry_run",
    ]);
  });
});
