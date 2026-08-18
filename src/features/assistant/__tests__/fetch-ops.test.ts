import { describe, it, expect } from "vitest";
import { FETCH_CONFIG, buildFullText, MAX_FETCH_CHARS } from "../fetch-ops";
import { DOMAIN_MENU_SLUG } from "../domain-menu";

/**
 * 검색(`search_ops`)은 200자 발췌만 준다 — "이게 있나"는 답하지만 "내용을 문서로
 * 옮겨줘"는 못 한다. 어시스턴트가 2026-08-18에 그걸 정확히 진단해 gap으로 남겼다:
 *
 *   "search_ops는 인수인계 레코드의 앞부분 발췌만 반환해서 '부산대학교 — 수시'
 *    본문 전체를 확인할 수 없었다. 레코드 ID로 전문을 읽는 도구가 필요하다."
 *
 * 그래서 찾기(search)와 읽기(fetch)를 가른다. 검색이 전문을 뱉으면 여러 건 검색할 때
 * 컨텍스트가 터진다.
 */

describe("FETCH_CONFIG", () => {
  it("검색과 같은 7개 도메인을 덮는다", () => {
    // 한쪽에만 있는 도메인이 생기면 "검색은 되는데 못 읽는" 구멍이 난다.
    expect(Object.keys(FETCH_CONFIG).sort()).toEqual(
      Object.keys(DOMAIN_MENU_SLUG).sort(),
    );
  });

  it("모든 도메인이 테이블과 본문 필드를 지정한다", () => {
    for (const [domain, cfg] of Object.entries(FETCH_CONFIG)) {
      expect(cfg.table, `${domain}.table`).toBeTruthy();
      expect(cfg.bodyFields.length, `${domain}.bodyFields`).toBeGreaterThan(0);
    }
  });
});

describe("buildFullText", () => {
  it("본문 필드를 라벨과 함께 잇는다", () => {
    const text = buildFullText(
      { work_basic_md: "기초엑셀 세팅", work_etc_md: "프로시저 3종" },
      [
        { key: "work_basic_md", label: "작업-기초" },
        { key: "work_etc_md", label: "작업-기타" },
      ],
    );
    expect(text).toContain("## 작업-기초");
    expect(text).toContain("기초엑셀 세팅");
    expect(text).toContain("## 작업-기타");
  });

  it("빈 필드는 건너뛴다 — 빈 제목만 늘어놓지 않는다", () => {
    const text = buildFullText({ a: "값", b: null, c: "  " }, [
      { key: "a", label: "에이" },
      { key: "b", label: "비" },
      { key: "c", label: "씨" },
    ]);
    expect(text).toContain("## 에이");
    expect(text).not.toContain("## 비");
    expect(text).not.toContain("## 씨");
  });

  it("전부 비면 빈 문자열이다", () => {
    expect(buildFullText({ a: null }, [{ key: "a", label: "에이" }])).toBe("");
  });

  it("상한을 넘으면 자르고 잘렸다고 밝힌다", () => {
    // 조용히 자르면 모델이 뒷부분이 없다는 걸 모른 채 "전부 읽었다"고 답한다.
    const long = "가".repeat(MAX_FETCH_CHARS + 500);
    const text = buildFullText({ a: long }, [{ key: "a", label: "에이" }]);
    expect(text.length).toBeLessThanOrEqual(MAX_FETCH_CHARS + 100);
    expect(text).toContain("잘렸습니다");
  });
});
