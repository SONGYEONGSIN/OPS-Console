import { describe, it, expect } from "vitest";
import { parseKeyValMap, loadSmileEdiConfig } from "../config";

describe("parseKeyValMap", () => {
  it("key:val,key:val 파싱", () => {
    expect(parseKeyValMap("서강대학교:박시현,덕성여자대학교:김슬기")).toEqual({
      서강대학교: "박시현",
      덕성여자대학교: "김슬기",
    });
  });
  it("값에 ':' 포함 시 첫 ':'만 분리 (이메일 등은 아니지만 방어)", () => {
    expect(parseKeyValMap("송영신:a:b")).toEqual({ 송영신: "a:b" });
  });
  it("빈 입력/잘못된 항목 무시", () => {
    expect(parseKeyValMap(undefined)).toEqual({});
    expect(parseKeyValMap("나쁜항목, 김슬기:x ")).toEqual({ 김슬기: "x" });
  });
});

describe("loadSmileEdiConfig", () => {
  const full = {
    SMILEEDI_ITEM_KEYWORDS: "수수료,접수,강사,대입,인터넷",
    SMILEEDI_MANAGER_EMAIL_MAP: "송영신:song@x.com,박시현:park@x.com",
    SMILEEDI_DEFAULT_MANAGER: "송영신",
    SMILEEDI_SENDER_EMAIL: "ops@x.com",
    SMILEEDI_COMPANY_MANAGER_MAP: "고려대학교:박시현",
    SMILEEDI_CC: "박시현:pkm0313@x.com,김승현:ksh@x.com",
  } as unknown as NodeJS.ProcessEnv;

  it("정상 — config + senderEmail", () => {
    const r = loadSmileEdiConfig(full);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.senderEmail).toBe("ops@x.com");
      expect(r.config.itemKeywords).toContain("수수료");
      expect(r.config.managerEmail["박시현"]).toBe("park@x.com");
      expect(r.config.defaultManager).toBe("송영신");
      expect(r.config.cc).toEqual([
        { name: "박시현", email: "pkm0313@x.com" },
        { name: "김승현", email: "ksh@x.com" },
      ]);
    }
  });

  it("SMILEEDI_CC 미설정 시 빈 배열", () => {
    const { SMILEEDI_CC: _omit, ...noCc } = full;
    void _omit;
    const r = loadSmileEdiConfig(noCc as NodeJS.ProcessEnv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.cc).toEqual([]);
  });

  it("필수 누락 시 즉시 실패 (폴백 금지)", () => {
    const r = loadSmileEdiConfig({} as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("SMILEEDI_ITEM_KEYWORDS");
      expect(r.error).toContain("SMILEEDI_SENDER_EMAIL");
    }
  });
});
