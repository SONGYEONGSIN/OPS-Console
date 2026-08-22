import { describe, it, expect } from "vitest";
import {
  formatApplyPeriod,
  applyNoticeUrl,
  ratioUrl,
  buildDefaultOpenNoticeText,
} from "../mail-template";

describe("formatApplyPeriod", () => {
  it("같은 해면 종료의 연도를 생략한다", () => {
    // KST 2026-09-08(화) 10:00 ~ 2026-09-11(금) 18:00
    expect(
      formatApplyPeriod("2026-09-08T01:00:00Z", "2026-09-11T09:00:00Z"),
    ).toBe("2026.09.08(화) 10:00 ~ 09.11(금) 18:00");
  });

  it("연도가 다르면 종료에도 연도를 찍는다", () => {
    // 실데이터의 연도 오류 7건(건국대 등)을 운영자가 알아채게 하는 자리다.
    // 생략하면 '2026.09.07 ~ 09.11' 로 멀쩡해 보이고 1년 틀린 기간이 발송된다.
    expect(
      formatApplyPeriod("2026-09-07T00:00:00Z", "2027-09-11T08:00:00Z"),
    ).toBe("2026.09.07(월) 09:00 ~ 2027.09.11(토) 17:00");
  });

  it("UTC 경계를 KST 날짜로 넘긴다", () => {
    // UTC 2026-09-07 15:00 = KST 2026-09-08 00:00 — 날짜가 하루 밀리면 안 된다
    expect(
      formatApplyPeriod("2026-09-07T15:00:00Z", "2026-09-30T14:59:59Z"),
    ).toBe("2026.09.08(화) 00:00 ~ 09.30(수) 23:59");
  });

  it("한쪽이라도 비면 빈 문자열", () => {
    expect(formatApplyPeriod(null, "2026-09-11T09:00:00Z")).toBe("");
    expect(formatApplyPeriod("2026-09-08T01:00:00Z", null)).toBe("");
    expect(formatApplyPeriod(null, null)).toBe("");
  });
});

describe("applyNoticeUrl", () => {
  it("공통원서는 apply 호스트", () => {
    expect(applyNoticeUrl(1130058, "공통원서")).toBe(
      "https://apply.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("반응형원서·일반접수는 enter 호스트", () => {
    expect(applyNoticeUrl(1108082, "반응형원서")).toBe(
      "https://enter.jinhakapply.com/Notice/1108082/A",
    );
    expect(applyNoticeUrl(1108082, "일반접수")).toBe(
      "https://enter.jinhakapply.com/Notice/1108082/A",
    );
  });

  it("비었거나 모르는 값이면 다수(enter) 쪽으로 둔다", () => {
    // entertest/target-url.ts 와 같은 규칙 — 분류가 비면 반응형원서로 본다
    expect(applyNoticeUrl(1, null)).toBe("https://enter.jinhakapply.com/Notice/1/A");
    expect(applyNoticeUrl(1, undefined)).toBe("https://enter.jinhakapply.com/Notice/1/A");
    expect(applyNoticeUrl(1, "일반원서")).toBe("https://enter.jinhakapply.com/Notice/1/A");
  });

  it("앞뒤 공백이 있어도 공통원서로 본다", () => {
    expect(applyNoticeUrl(1130058, " 공통원서 ")).toBe(
      "https://apply.jinhakapply.com/Notice/1130058/A",
    );
  });
});

describe("ratioUrl", () => {
  it("서비스ID 뒤에 차수 1을 붙인다", () => {
    expect(ratioUrl(1130058)).toBe(
      "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio11300581.html",
    );
  });
});

describe("buildDefaultOpenNoticeText", () => {
  const args = {
    operatorName: "홍길동",
    universityName: "조선대학교",
    serviceName: "2027학년도 수시모집",
    serviceId: 1130058,
    admissionType: "공통원서",
    writeStartAt: "2026-09-08T01:00:00Z",
    writeEndAt: "2026-09-11T09:00:00Z",
  };

  it("제목은 대학명 + 서비스명", () => {
    expect(buildDefaultOpenNoticeText(args).subject).toBe(
      "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내",
    );
  });

  it("본문에 오픈 정보 네 칸이 들어간다", () => {
    const { body } = buildDefaultOpenNoticeText(args);
    expect(body).toContain("진학어플라이 홍길동입니다.");
    expect(body).toContain("■ 오픈 정보");
    expect(body).toContain("· 대학명   : 조선대학교");
    expect(body).toContain("· 모집구분 : 2027학년도 수시모집");
    expect(body).toContain("· 접수기간 : 2026.09.08(화) 10:00 ~ 09.11(금) 18:00");
    expect(body).toContain(
      "· 접수주소 : https://apply.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("본문에 운영 안내가 들어간다", () => {
    const { body } = buildDefaultOpenNoticeText(args);
    expect(body).toContain("■ 접수기간 중 운영 안내");
    expect(body).toContain("· 접수관리자  : https://nadmin.jinhakapply.com/Login.aspx");
    expect(body).toContain("· 지원자 문의 : 진학어플라이 고객센터 1544-7715");
    expect(body).toContain("평일 09:00~18:00");
  });

  it("경쟁률이 꺼지면 접수관리자 설명에서도 '경쟁률' 이 빠진다", () => {
    // 경쟁률을 안 쓰는 서비스면 관리자 화면 설명에도 그 단어가 없어야 한다.
    const { body } = buildDefaultOpenNoticeText(args);
    expect(body).toContain("   └ 접수현황 실시간 조회");
    expect(body).not.toContain("경쟁률");
  });

  it("경쟁률이 켜지면 접수관리자 설명에 '경쟁률' 이 돌아온다", () => {
    const { body } = buildDefaultOpenNoticeText({ ...args, includeRatio: true });
    expect(body).toContain("   └ 접수현황·경쟁률 실시간 조회");
  });

  it("경쟁률 줄은 기본으로 빠진다", () => {
    // 경쟁률을 공개하지 않는 서비스가 295건 중 59건이다. 기본으로 넣으면
    // 그 대학 담당자에게 404 링크를 보내게 된다.
    const { body } = buildDefaultOpenNoticeText(args);
    expect(body).not.toContain("경쟁률 공개");
    expect(body).not.toContain("addon.jinhakapply.com");
    expect(body).not.toContain("지원자 경쟁률 실시간 조회");
  });

  it("includeRatio 를 켜면 경쟁률 줄이 들어간다", () => {
    const { body } = buildDefaultOpenNoticeText({ ...args, includeRatio: true });
    expect(body).toContain(
      "· 경쟁률 공개 : https://addon.jinhakapply.com/RatioV1/RatioH/Ratio11300581.html",
    );
    expect(body).toContain("지원자 경쟁률 실시간 조회");
  });

  it("경쟁률을 빼도 나머지 줄 순서는 그대로다", () => {
    const { body } = buildDefaultOpenNoticeText(args);
    const admin = body.indexOf("· 접수관리자");
    const ask = body.indexOf("· 지원자 문의");
    expect(admin).toBeGreaterThan(-1);
    expect(ask).toBeGreaterThan(admin);
  });

  it("구분선은 좁은 화면에서 안 접히게 짧다", () => {
    // 32자였을 때 모바일 메일에서 두 줄로 갈라졌다.
    const { body } = buildDefaultOpenNoticeText(args);
    const divider = body.split("\n").find((l) => l.startsWith("─"));
    expect(divider).toBeDefined();
    expect(divider!.length).toBeLessThanOrEqual(20);
  });

  it("모집구분은 service_name 을 가공 없이 쓴다", () => {
    const { body } = buildDefaultOpenNoticeText({ ...args, serviceName: "수시1차" });
    expect(body).toContain("· 모집구분 : 수시1차");
  });

  it("접수기간을 못 만들면 칸을 지우지 않고 빈 값으로 남긴다", () => {
    // 줄을 없애면 운영자가 누락을 못 알아챈다. 빈칸은 눈에 띄어 채우게 된다.
    const { body } = buildDefaultOpenNoticeText({ ...args, writeStartAt: null });
    expect(body).toContain("· 접수기간 : ");
    expect(body).not.toContain("undefined");
  });
});
