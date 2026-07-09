import { describe, it, expect } from "vitest";
import {
  recipientSchema,
  reminderItemSchema,
  reminderGroupSchema,
  operatorReminderGroupSchema,
  sendReminderInputSchema,
} from "../mail-schemas";

const validRecipient = {
  email: "manager@school.ac.kr",
  name: "김교사",
};

const validItem = {
  customerName: "○○대학교",
  invoiceDate: "2026-04-01",
  description: "수시 원서접수 시스템 4월",
  daysOverdue: 12,
  amount: 1_500_000,
  operatorLabel: "송영신",
};

const validGroup = {
  recipient: validRecipient,
  items: [validItem],
  totalAmount: 1_500_000,
};

const validOperatorGroup = {
  ...validGroup,
  sender: { name: "송영신", email: "ys1114@jinhakapply.com" },
};

describe("recipientSchema", () => {
  it("올바른 이메일 + 이름 통과", () => {
    expect(recipientSchema.safeParse(validRecipient).success).toBe(true);
  });

  it("잘못된 이메일 형식 거부", () => {
    const r = recipientSchema.safeParse({ email: "not-an-email", name: "x" });
    expect(r.success).toBe(false);
  });

  it("name 누락 허용 (학교담당자 이름이 없는 경우 있음)", () => {
    const r = recipientSchema.safeParse({ email: "ok@ex.com" });
    expect(r.success).toBe(true);
  });
});

describe("reminderItemSchema", () => {
  it("daysOverdue 음수 거부", () => {
    const bad = { ...validItem, daysOverdue: -1 };
    expect(reminderItemSchema.safeParse(bad).success).toBe(false);
  });

  it("amount 음수 거부", () => {
    const bad = { ...validItem, amount: -100 };
    expect(reminderItemSchema.safeParse(bad).success).toBe(false);
  });

  it("정상 row 통과", () => {
    expect(reminderItemSchema.safeParse(validItem).success).toBe(true);
  });
});

describe("reminderGroupSchema", () => {
  it("items 빈 배열 거부 (발송 대상 없는 그룹 금지)", () => {
    const bad = { ...validGroup, items: [] };
    expect(reminderGroupSchema.safeParse(bad).success).toBe(false);
  });

  it("정상 그룹 통과", () => {
    expect(reminderGroupSchema.safeParse(validGroup).success).toBe(true);
  });
});

describe("operatorReminderGroupSchema", () => {
  it("sender(발신 운영자) 포함 그룹 통과", () => {
    expect(
      operatorReminderGroupSchema.safeParse(validOperatorGroup).success,
    ).toBe(true);
  });

  it("sender 누락 거부 — 발신 운영자 없이는 발송 불가", () => {
    expect(operatorReminderGroupSchema.safeParse(validGroup).success).toBe(
      false,
    );
  });

  it("sender.email 형식 오류 거부", () => {
    const bad = {
      ...validOperatorGroup,
      sender: { name: "송영신", email: "not-an-email" },
    };
    expect(operatorReminderGroupSchema.safeParse(bad).success).toBe(false);
  });
});

describe("sendReminderInputSchema", () => {
  it("bundle scope 정상 input 통과", () => {
    const ok = {
      recipientEmail: "manager@school.ac.kr",
      scope: "bundle",
      dryRun: true,
    };
    expect(sendReminderInputSchema.safeParse(ok).success).toBe(true);
  });

  it("single scope + customerName 통과", () => {
    const ok = {
      recipientEmail: "manager@school.ac.kr",
      scope: "single",
      customerName: "○○대학교",
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(ok).success).toBe(true);
  });

  it("single scope 인데 customerName 누락 거부", () => {
    const bad = {
      recipientEmail: "manager@school.ac.kr",
      scope: "single",
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(bad).success).toBe(false);
  });

  it("recipientEmail 형식 오류 거부", () => {
    const bad = {
      recipientEmail: "not-an-email",
      scope: "bundle",
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(bad).success).toBe(false);
  });

  it("알 수 없는 scope 거부", () => {
    const bad = {
      recipientEmail: "manager@school.ac.kr",
      scope: "everything",
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(bad).success).toBe(false);
  });

  it("클라이언트가 groups(발신자 포함)를 실어보내도 무시 — 서버 재도출", () => {
    const withGroups = {
      recipientEmail: "manager@school.ac.kr",
      scope: "bundle",
      dryRun: false,
      groups: [validOperatorGroup],
    };
    const r = sendReminderInputSchema.safeParse(withGroups);
    expect(r.success).toBe(true);
    expect(r.success && "groups" in r.data).toBe(false);
  });
});
