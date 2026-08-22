import { describe, it, expect } from "vitest";
import { openNoticeAutoSendInputSchema } from "../schemas";

const valid = {
  serviceId: 1130058,
  universityName: "조선대학교",
  serviceName: "2027학년도 수시모집",
  toEmail: "a@b.com",
  toName: "김담당",
  cc: [{ email: "c@d.com" }],
  subject: "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내",
  body: "안녕하세요",
};

describe("openNoticeAutoSendInputSchema", () => {
  it("정상 입력을 통과시킨다", () => {
    expect(openNoticeAutoSendInputSchema.safeParse(valid).success).toBe(true);
  });

  it("발송 시각은 입력받지 않는다 — 서버가 write_start_at 에서 읽는다", () => {
    const p = openNoticeAutoSendInputSchema.safeParse({
      ...valid,
      scheduledAt: "2026-09-08T10:00",
      mode: "schedule",
    });
    expect(p.success).toBe(true);
    if (p.success) {
      expect("scheduledAt" in p.data).toBe(false);
      expect("mode" in p.data).toBe(false);
    }
  });

  it("serviceId 는 정수 필수", () => {
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, serviceId: null }).success).toBe(false);
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, serviceId: undefined }).success).toBe(false);
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, serviceId: 1.5 }).success).toBe(false);
  });

  it("문자열 serviceId 는 숫자로 변환된다 (FormData 경로)", () => {
    const p = openNoticeAutoSendInputSchema.safeParse({ ...valid, serviceId: "1130058" });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.serviceId).toBe(1130058);
  });

  it("toEmail 형식 검사", () => {
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, toEmail: "x" }).success).toBe(false);
  });

  it("subject/body 는 빈 값 불가", () => {
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
    expect(openNoticeAutoSendInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });

  it("cc 기본값은 빈 배열", () => {
    const { cc: _drop, ...withoutCc } = valid;
    const p = openNoticeAutoSendInputSchema.safeParse(withoutCc);
    expect(p.success && p.data.cc).toEqual([]);
  });
});
