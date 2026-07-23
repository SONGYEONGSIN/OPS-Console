import { describe, it, expect } from "vitest";
import {
  sanitizeNoteHtml,
  stripNoteHtml,
  extractNoteImages,
} from "../note-html";

const PREFIX = "https://test.supabase.co/storage/v1/object/public/checklist/";

describe("sanitizeNoteHtml (공개 토큰 입력 → XSS 방어)", () => {
  it("허용 태그(텍스트·br·우리 스토리지 img)는 유지", () => {
    const html = `안녕<br>세계<img src="${PREFIX}a/b/c.png" alt="x">`;
    const out = sanitizeNoteHtml(html, PREFIX);
    expect(out).toContain("안녕");
    expect(out).toContain("<br");
    expect(out).toContain(`<img`);
    expect(out).toContain(`${PREFIX}a/b/c.png`);
  });

  it("script 태그 제거", () => {
    const out = sanitizeNoteHtml(`글<script>alert(1)</script>`, PREFIX);
    expect(out).not.toContain("script");
    expect(out).toContain("글");
  });

  it("img onerror 등 이벤트 속성 제거", () => {
    const out = sanitizeNoteHtml(
      `<img src="${PREFIX}x.png" onerror="alert(1)">`,
      PREFIX,
    );
    expect(out).not.toContain("onerror");
  });

  it("리사이즈 width(숫자)는 보존, 비숫자 width는 제거", () => {
    const keep = sanitizeNoteHtml(
      `<img src="${PREFIX}x.png" width="300">`,
      PREFIX,
    );
    expect(keep).toContain('width="300"');
    const strip = sanitizeNoteHtml(
      `<img src="${PREFIX}x.png" width="abc">`,
      PREFIX,
    );
    expect(strip).not.toContain("abc");
  });

  it("우리 스토리지가 아닌 외부 img는 제거", () => {
    const out = sanitizeNoteHtml(`<img src="https://evil.com/x.png">`, PREFIX);
    expect(out).not.toContain("evil.com");
    expect(out).not.toContain("<img");
  });

  it("javascript: src 등 위험 스킴 제거", () => {
    const out = sanitizeNoteHtml(`<img src="javascript:alert(1)">`, PREFIX);
    expect(out).not.toContain("javascript:");
  });
});

describe("stripNoteHtml (PDF·텍스트용)", () => {
  it("태그 제거 + 줄바꿈 보존", () => {
    const out = stripNoteHtml(`첫줄<br>둘째<div>셋째</div>`);
    expect(out).not.toContain("<");
    expect(out).toContain("첫줄");
    expect(out).toContain("둘째");
    expect(out).toContain("셋째");
    expect(out.split("\n").length).toBeGreaterThan(1);
  });
});

describe("extractNoteImages", () => {
  it("img src 목록 추출", () => {
    const html = `a<img src="${PREFIX}1.png">b<img src="${PREFIX}2.png">`;
    expect(extractNoteImages(html)).toEqual([
      `${PREFIX}1.png`,
      `${PREFIX}2.png`,
    ]);
  });
  it("이미지 없으면 빈 배열", () => {
    expect(extractNoteImages("텍스트만")).toEqual([]);
  });
});
