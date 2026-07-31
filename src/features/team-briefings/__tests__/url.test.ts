import { describe, it, expect, afterEach } from "vitest";
import { briefingUrl } from "../url";

const saved = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = saved;
});

describe("briefingUrl", () => {
  it("NEXT_PUBLIC_APP_URL 기준으로 공유 경로를 만든다", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com";
    expect(briefingUrl("abc")).toBe("https://ops.example.com/r/briefing/abc");
  });

  it("끝 슬래시가 있어도 중복되지 않는다", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com/";
    expect(briefingUrl("abc")).toBe("https://ops.example.com/r/briefing/abc");
  });
});
