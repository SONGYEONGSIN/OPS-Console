import { describe, it, expect } from "vitest";
import {
  scheduleTypeSchema,
  scheduleEventCreateSchema,
  scheduleEventRowSchema,
  scheduleEventUpdateSchema,
} from "../schemas";

describe("schedule schemas — type enum", () => {
  it.each([
    "shift",
    "event",
    "leave",
    "training",
    "application",
    "pims",
  ] as const)("%s — 유효 type", (t) => {
    expect(scheduleTypeSchema.parse(t)).toBe(t);
  });

  it("알 수 없는 type — reject", () => {
    expect(() => scheduleTypeSchema.parse("unknown")).toThrow();
  });
});

describe("scheduleEventCreateSchema", () => {
  const valid = {
    type: "event" as const,
    title: "운영 회의",
    start_at: "2026-05-15T09:00:00Z",
    end_at: "2026-05-15T10:00:00Z",
    assignee_email: "ys1114@jinhakapply.com",
    created_by_email: "ys1114@jinhakapply.com",
    all_day: false,
    description: null,
  };

  it("유효 입력 — parse 성공", () => {
    expect(scheduleEventCreateSchema.parse(valid).title).toBe("운영 회의");
  });

  it("title 빈 문자 — reject", () => {
    expect(() =>
      scheduleEventCreateSchema.parse({ ...valid, title: "" }),
    ).toThrow();
  });

  it("end_at < start_at — reject", () => {
    expect(() =>
      scheduleEventCreateSchema.parse({
        ...valid,
        start_at: "2026-05-15T10:00:00Z",
        end_at: "2026-05-15T09:00:00Z",
      }),
    ).toThrow();
  });

  it("end_at == start_at — 허용 (즉시 종료 이벤트)", () => {
    const same = "2026-05-15T09:00:00Z";
    expect(
      scheduleEventCreateSchema.parse({
        ...valid,
        start_at: same,
        end_at: same,
      }).end_at,
    ).toBe(same);
  });

  it("end_at 생략 — 허용 (open-ended)", () => {
    const { end_at: _omit, ...rest } = valid;
    expect(scheduleEventCreateSchema.parse(rest).end_at ?? null).toBeNull();
  });

  it("assignee_email 생략 — 허용 (팀 공통)", () => {
    const { assignee_email: _omit, ...rest } = valid;
    expect(
      scheduleEventCreateSchema.parse(rest).assignee_email ?? null,
    ).toBeNull();
  });

  it("created_by_email 잘못된 형식 — reject", () => {
    expect(() =>
      scheduleEventCreateSchema.parse({ ...valid, created_by_email: "x" }),
    ).toThrow();
  });
});

describe("scheduleEventRowSchema", () => {
  it("DB row 형식 — id/created_at/updated_at 포함 parse", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      type: "shift" as const,
      title: "주간 시프트",
      description: null,
      start_at: "2026-05-15T05:00:00Z",
      end_at: "2026-05-15T13:00:00Z",
      all_day: false,
      assignee_email: null,
      created_by_email: "ys1114@jinhakapply.com",
      created_at: "2026-05-10T15:00:00Z",
      updated_at: "2026-05-10T15:00:00Z",
    };
    expect(scheduleEventRowSchema.parse(row).id).toBe(row.id);
  });
});

describe("scheduleEventUpdateSchema", () => {
  it("부분 업데이트 — title만", () => {
    const parsed = scheduleEventUpdateSchema.parse({ title: "변경" });
    expect(parsed.title).toBe("변경");
  });

  it("update에서 end_at < start_at — reject (둘 다 제공된 경우)", () => {
    expect(() =>
      scheduleEventUpdateSchema.parse({
        start_at: "2026-05-15T10:00:00Z",
        end_at: "2026-05-15T09:00:00Z",
      }),
    ).toThrow();
  });

  it("update에서 start_at만 제공 — 허용 (end_at 비교 skip)", () => {
    const parsed = scheduleEventUpdateSchema.parse({
      start_at: "2026-05-15T10:00:00Z",
    });
    expect(parsed.start_at).toBe("2026-05-15T10:00:00Z");
  });
});
