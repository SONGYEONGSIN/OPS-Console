import { describe, it, expect } from "vitest";
import { sendOpenNoticeInputSchema } from "../schemas";

const valid = {
  serviceId: 1130058,
  universityName: "조선대학교",
  serviceName: "2027학년도 수시모집",
  toEmail: "a@b.com",
  toName: "김담당",
  cc: [{ email: "c@d.com" }],
  subject: "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내",
  body: "안녕하세요",
  mode: "now" as const,
};

describe("sendOpenNoticeInputSchema", () => {
  it("정상 입력을 통과시킨다", () => {
    expect(sendOpenNoticeInputSchema.safeParse(valid).success).toBe(true);
  });

  it("serviceId 는 정수 필수 — 자료요청과 달리 nullable 이 아니다", () => {
    // 목록이 항상 Moa 서비스ID를 준다. 없으면 접수주소 URL을 만들 수 없다.
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, serviceId: null }).success).toBe(false);
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, serviceId: undefined }).success).toBe(false);
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, serviceId: 1.5 }).success).toBe(false);
  });

  it("문자열 serviceId 는 숫자로 강제된다 (FormData 경로)", () => {
    const p = sendOpenNoticeInputSchema.safeParse({ ...valid, serviceId: "1130058" });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.serviceId).toBe(1130058);
  });

  it("toEmail 형식 검사", () => {
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, toEmail: "x" }).success).toBe(false);
  });

  it("subject/body 는 빈 값 불가", () => {
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });

  it("mode 기본값은 now, schedule 허용", () => {
    const p = sendOpenNoticeInputSchema.safeParse({ ...valid, mode: undefined });
    expect(p.success && p.data.mode).toBe("now");
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, mode: "schedule" }).success).toBe(true);
    expect(sendOpenNoticeInputSchema.safeParse({ ...valid, mode: "later" }).success).toBe(false);
  });

  it("cc 기본값은 빈 배열", () => {
    const { cc: _drop, ...withoutCc } = valid;
    const p = sendOpenNoticeInputSchema.safeParse(withoutCc);
    expect(p.success && p.data.cc).toEqual([]);
  });
});
