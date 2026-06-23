import { describe, it, expect } from "vitest";
import {
  tokenizeTitle,
  similarContext,
  dedupeByContext,
} from "../news-context";

describe("tokenizeTitle", () => {
  it("출처 접미사(' - 출처')와 대괄호 태그를 제거한다", () => {
    const t = tokenizeTitle(
      "[단독] 광양보건대 폐교 전망 - 한국대학신문",
      "한국대학신문",
    );
    expect(t).toContain("광양보건대");
    expect(t).toContain("폐교");
    expect(t).not.toContain("단독");
    expect(t).not.toContain("한국대학신문");
  });

  it("조사를 떼어 같은 어근으로 정규화한다", () => {
    const t = tokenizeTitle("광양보건대 파산이 남긴 책임");
    expect(t).toContain("파산"); // '파산이' → '파산'
  });

  it("1글자·숫자·범용어(대학/뉴스)는 토큰에서 제외한다", () => {
    const t = tokenizeTitle("대학 뉴스 3% 감축");
    expect(t).not.toContain("대학");
    expect(t).not.toContain("뉴스");
    expect(t).not.toContain("3");
  });
});

describe("similarContext — 동일 맥락 판정", () => {
  it("긴 고유명사(광양보건대)를 공유하면 같은 맥락", () => {
    const a = tokenizeTitle("광양보건대 학교법인 파산 선고 폐교 수순");
    const b = tokenizeTitle('"광양보건대 폐교, 지역사회 모두의 아픔"');
    expect(similarContext(a, b)).toBe(true);
  });

  it("범용어 1개만 겹치면 다른 맥락", () => {
    const a = tokenizeTitle("광양보건대 폐교 수순");
    const b = tokenizeTitle("정원 3% 감축 지방 사립대 50억 지원");
    expect(similarContext(a, b)).toBe(false);
  });
});

// 실제 수집 데이터(2026-06 폐교 키워드) 기반 군집 회귀 픽스처
const REAL = [
  [
    "2026-06-22",
    "[시사칼럼] 폐교만이 정답이었나? 광양보건대 파산이 남긴 지역 정치권의 책임 - ppss.kr",
  ],
  [
    "2026-06-22",
    "[단독] ‘이홍하 비리’ 여파 끝내 못 넘어… ‘13년 후폭풍’ 광양보건대 폐교 전망 - 한국대학신문",
  ],
  ["2026-06-22", '"광양보건대 폐교, 지역사회 모두의 아픔" - gmitoday.com'],
  ["2026-06-22", "광양보건대 학교법인 파산 선고… 폐교 수순 밟나 - 남도방송"],
  ["2026-06-21", "광양보건대 끝내 폐교…법원, 파산선고 - 광양뉴스"],
  ["2026-06-21", "법원, 양남학원 파산선고…광양보건대 폐교 수순 - 광양시민신문"],
  [
    "2026-06-20",
    "‘비리·재정난’ 광양보건대 법인 최종 파산…결국 폐교 수순 > 뉴스 - 더코리아",
  ],
  ["2026-06-17", "'정원 3% 감축' 지방 사립대 뽑아 연 50억 지원 - 네이트"],
  [
    "2026-06-11",
    "[특파원 REPORT] 하버드대, ‘학점누적형 학위인증제’ 선점 행보 - usline.kr",
  ],
  [
    "2026-06-09",
    "폐교보다 어려운 청산…사학 구조개선 세금 문제 준비해야 - 조세일보",
  ],
].map(([published_at, title]) => ({ published_at, title }));

describe("dedupeByContext — 군집별 최신 1건", () => {
  it("광양보건대 파산·폐교 7건은 1건(최신)으로 접힌다", () => {
    const out = dedupeByContext(REAL);
    const gy = out.filter((r) => r.title.includes("광양보건대"));
    expect(gy).toHaveLength(1);
    expect(gy[0].published_at).toBe("2026-06-22");
  });

  it("서로 다른 맥락(정원감축·하버드·청산세금)은 보존된다", () => {
    const out = dedupeByContext(REAL);
    expect(out.some((r) => r.title.includes("3% 감축"))).toBe(true);
    expect(out.some((r) => r.title.includes("하버드"))).toBe(true);
    expect(out.some((r) => r.title.includes("청산"))).toBe(true);
  });

  it("입력을 변형하지 않는다(불변)", () => {
    const before = REAL.map((r) => r.title);
    dedupeByContext(REAL);
    expect(REAL.map((r) => r.title)).toEqual(before);
  });
});
