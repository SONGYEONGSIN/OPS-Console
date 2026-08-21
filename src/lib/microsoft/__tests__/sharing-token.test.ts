import { describe, it, expect } from "vitest";
import { toSharingToken } from "../sharing-token";

/**
 * SharePoint·Teams 링크를 Graph 가 알아듣는 토큰으로 바꾼다.
 *
 * 링크 모양이 제각각이다 — 채널 파일, 채팅 파일, 공유 링크, 주소창에서 복사한 것.
 * 모양마다 파싱하면 새 형태가 나올 때마다 깨진다. Graph 의 `/shares/{token}` 은
 * **URL 을 그대로 감싸면** 알아서 풀어주므로, 우리는 감싸기만 한다.
 */
describe("공유 토큰", () => {
  it("u! 로 시작한다 — Graph 가 요구하는 접두사다", () => {
    expect(toSharingToken("https://x.sharepoint.com/a")).toMatch(/^u!/);
  });

  it("base64url 이다 — +, /, = 가 남으면 경로에서 깨진다", () => {
    const t = toSharingToken(
      "https://tenant.sharepoint.com/:w:/r/sites/운영부/문서/보고서.docx?d=w123&csf=1",
    );
    expect(t.slice(2)).not.toMatch(/[+/=]/);
  });

  it("같은 링크는 같은 토큰이다", () => {
    const url = "https://x.sharepoint.com/sites/a/b.docx";
    expect(toSharingToken(url)).toBe(toSharingToken(url));
  });

  it("한글 경로도 담는다 — 볼트·운영부 폴더 이름이 한글이다", () => {
    const t = toSharingToken("https://x.sharepoint.com/sites/운영부/보고서.docx");
    expect(t).toMatch(/^u!/);
    // 되돌리면 원문이 나온다.
    const b64 = t.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    expect(decoded).toContain("운영부");
  });

  it("앞뒤 공백은 떼어낸다 — 복사하면 딸려 온다", () => {
    expect(toSharingToken("  https://x.sharepoint.com/a  ")).toBe(
      toSharingToken("https://x.sharepoint.com/a"),
    );
  });

  it("http(s) 링크가 아니면 거절한다 — 아무 문자열이나 Graph 에 보내지 않는다", () => {
    expect(() => toSharingToken("보고서.docx")).toThrow();
    expect(() => toSharingToken("javascript:alert(1)")).toThrow();
  });

  it("우리 테넌트가 아닌 곳은 거절한다 — 남의 파일을 끌어오지 않는다", () => {
    expect(() => toSharingToken("https://evil.example.com/a.docx")).toThrow();
  });

  it("sharepoint.com·onedrive 도메인은 받는다", () => {
    expect(() =>
      toSharingToken("https://tenant-my.sharepoint.com/personal/a/b.docx"),
    ).not.toThrow();
  });
});
