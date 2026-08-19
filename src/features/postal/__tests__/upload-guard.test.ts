import { describe, it, expect } from "vitest";
import {
  assertUploadable,
  receiptStoragePath,
  MAX_RECEIPT_BYTES,
} from "../upload-guard";

/**
 * 영수증 업로드 방어.
 *
 * 올리는 건 **사진 파일 하나**다. 그 밖의 것이 버킷에 들어가면, 나중에 서명 URL로
 * 그대로 내보내지므로 저장 순간이 유일한 관문이다.
 */
describe("assertUploadable", () => {
  it("사진만 받는다", () => {
    expect(() => assertUploadable("a.jpg", "image/jpeg", 1000)).not.toThrow();
    expect(() => assertUploadable("a.png", "image/png", 1000)).not.toThrow();
    expect(() => assertUploadable("a.heic", "image/heic", 1000)).not.toThrow();
  });

  it("사진이 아니면 막는다 — 확장자만 바꾼 것도", () => {
    expect(() => assertUploadable("a.pdf", "application/pdf", 10)).toThrow();
    // 확장자는 jpg인데 실제 타입이 다른 경우
    expect(() => assertUploadable("a.jpg", "text/html", 10)).toThrow();
    // 타입은 이미지라 우겨도 확장자가 실행 파일이면 막는다
    expect(() => assertUploadable("a.svg", "image/svg+xml", 10)).toThrow();
  });

  it("빈 파일과 너무 큰 파일을 막는다", () => {
    expect(() => assertUploadable("a.jpg", "image/jpeg", 0)).toThrow();
    expect(() =>
      assertUploadable("a.jpg", "image/jpeg", MAX_RECEIPT_BYTES + 1),
    ).toThrow();
  });
});

describe("receiptStoragePath", () => {
  it("올린 사람과 날짜로 갈라 담는다", () => {
    const p = receiptStoragePath("2026-08-19", "abc123", "a.jpg");
    expect(p).toBe("2026-08-19/abc123.jpg");
  });

  it("원본 파일명을 경로에 쓰지 않는다 — 이름에 경로가 들어올 수 있다", () => {
    const p = receiptStoragePath("2026-08-19", "abc123", "../../etc/passwd.png");
    expect(p).toBe("2026-08-19/abc123.png");
    expect(p).not.toContain("..");
  });

  it("모르는 확장자는 던진다 — 조용히 붙이면 무엇이 저장됐는지 알 수 없다", () => {
    expect(() => receiptStoragePath("2026-08-19", "abc", "a.exe")).toThrow();
  });
});
