import { describe, it, expect } from "vitest";
import { cleanMailBody } from "../clean-body";

describe("cleanMailBody", () => {
  it("선두 추적 비콘 대괄호 bare-URL을 제거한다", () => {
    const raw =
      "[http://webmail.kcue.or.kr/mail/dsn/3540352]\r\n\r\n안녕하세요.\r\n본문입니다.";
    expect(cleanMailBody(raw)).toBe("안녕하세요.\n본문입니다.");
  });

  it("[cid:...] 인라인 이미지 참조를 제거한다", () => {
    const raw =
      "안녕하세요.\r\n\r\n[cid:1767836043549.311305.0.png]\r\n\r\n감사합니다.";
    expect(cleanMailBody(raw)).toBe("안녕하세요.\n\n감사합니다.");
  });

  it("이메일/URL 뒤 <mailto:...> <http...> 마크업을 제거하고 표시 텍스트만 남긴다", () => {
    const raw = "E-Mail : sol4684@kcue.or.kr<mailto:sol4684@kcue.or.kr>";
    expect(cleanMailBody(raw)).toBe("E-Mail : sol4684@kcue.or.kr");
  });

  it("https 비콘과 대괄호 URL도 제거한다", () => {
    const raw = "[https://track.example.com/open?id=1]\r\n본문";
    expect(cleanMailBody(raw)).toBe("본문");
  });

  it("3줄 이상 연속 빈 줄은 2줄로 축약한다", () => {
    const raw = "첫 줄.\n\n\n\n둘째 줄.";
    expect(cleanMailBody(raw)).toBe("첫 줄.\n\n둘째 줄.");
  });

  it("일반 본문(아티팩트 없음)은 줄바꿈 정규화 외 변형하지 않는다", () => {
    const raw = "결제가 안 됩니다. 확인 부탁드립니다.";
    expect(cleanMailBody(raw)).toBe("결제가 안 됩니다. 확인 부탁드립니다.");
  });

  it("일반 텍스트 내 대괄호(비-URL)는 보존한다", () => {
    const raw = "[진학대학교] 원서접수 문의";
    expect(cleanMailBody(raw)).toBe("[진학대학교] 원서접수 문의");
  });

  it("null/빈 값은 그대로 반환한다", () => {
    expect(cleanMailBody(null)).toBeNull();
    expect(cleanMailBody("")).toBe("");
  });
});
