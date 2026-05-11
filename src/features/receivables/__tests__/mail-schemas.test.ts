import { describe, it, expect } from "vitest";
import {
  recipientSchema,
  reminderItemSchema,
  reminderGroupSchema,
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

describe("sendReminderInputSchema", () => {
  it("thresholdDays 0 이하 거부", () => {
    const bad = {
      thresholdDays: 0,
      groups: [validGroup],
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(bad).success).toBe(false);
  });

  it("groups 빈 배열 거부", () => {
    const bad = {
      thresholdDays: 10,
      groups: [],
      dryRun: false,
    };
    expect(sendReminderInputSchema.safeParse(bad).success).toBe(false);
  });

  it("정상 input 통과", () => {
    const ok = {
      thresholdDays: 10,
      groups: [validGroup],
      dryRun: true,
    };
    expect(sendReminderInputSchema.safeParse(ok).success).toBe(true);
  });
});
