import { describe, it, expect } from "vitest";
import { sendDataRequestInputSchema } from "../schemas";

const valid = {
  serviceId: "svc-1",
  universityName: "조선대학교",
  toEmail: "a@b.com",
  toName: "김담당",
  cc: [{ email: "c@d.com", name: "이참조" }],
  subject: "자료 요청",
  body: "안녕하세요.",
};

describe("sendDataRequestInputSchema", () => {
  it("정상 입력 파싱", () => {
    expect(sendDataRequestInputSchema.safeParse(valid).success).toBe(true);
  });
  it("cc 기본값 빈 배열", () => {
    const { cc: _c, ...rest } = valid;
    void _c;
    const r = sendDataRequestInputSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cc).toEqual([]);
  });
  it("toEmail 형식 불량 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, toEmail: "x" }).success).toBe(false);
  });
  it("빈 제목 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
  });
  it("빈 본문 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });
});
