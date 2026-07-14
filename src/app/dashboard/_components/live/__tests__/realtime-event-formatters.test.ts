import { describe, it, expect } from "vitest";
import {
  parseWorklogRow,
  parseIncidentRow,
  parseTodoRow,
  parseBackupRequestRow,
  parseDataRequestSendRow,
  parseHandoverRecordRow,
  formatWorklogConsoleLine,
  formatIncidentToast,
  formatTodoToast,
  formatBackupRequestToast,
  formatDataRequestSendToast,
  formatHandoverToast,
} from "../realtime-event-formatters";

describe("토스트 채널 payload 검증 — RLS 미인가 빈 payload는 null", () => {
  it("parseIncidentRow: 정상 → row / 빈·누락 → null", () => {
    expect(
      parseIncidentRow({ title: "Redis 장애", owner_email: "a@b.c" }),
    ).toMatchObject({ title: "Redis 장애", owner_email: "a@b.c" });
    expect(parseIncidentRow({ title: "장애" })).toMatchObject({
      title: "장애",
      owner_email: null,
    });
    expect(parseIncidentRow({})).toBeNull();
    expect(parseIncidentRow(null)).toBeNull();
  });

  it("parseTodoRow: 정상 → row / 빈 → null", () => {
    expect(parseTodoRow({ title: "문서 정리" })).toMatchObject({
      title: "문서 정리",
    });
    expect(parseTodoRow({})).toBeNull();
  });

  it("parseBackupRequestRow: 정상 → row / 빈·필수 누락 → null", () => {
    expect(
      parseBackupRequestRow({
        summary_md: "백업 요청",
        requester_email: "a@b.c",
      }),
    ).toMatchObject({ summary_md: "백업 요청", requester_email: "a@b.c" });
    expect(parseBackupRequestRow({})).toBeNull();
    expect(parseBackupRequestRow({ summary_md: "만" })).toBeNull();
  });

  it("parseDataRequestSendRow: 정상 → row / 빈 → null", () => {
    expect(
      parseDataRequestSendRow({
        university_name: "중앙대학교",
        status: "sent",
        created_by_email: "a@b.c",
      }),
    ).toMatchObject({ university_name: "중앙대학교", status: "sent" });
    expect(parseDataRequestSendRow({})).toBeNull();
  });

  it("parseHandoverRecordRow: 정상 → row / 빈 → null", () => {
    expect(
      parseHandoverRecordRow({
        author_name: "홍길동",
        author_email: "hong@example.com",
        service_id: "abc-123",
      }),
    ).toMatchObject({ author_name: "홍길동", service_id: "abc-123" });
    expect(parseHandoverRecordRow({})).toBeNull();
  });
});

describe("parseWorklogRow", () => {
  it("정상 payload → row 반환", () => {
    expect(
      parseWorklogRow({
        level: "INFO",
        domain: "nav",
        msg: "페이지 진입",
        user_name: "김지나",
        user_email: "jina@example.com",
      }),
    ).toMatchObject({
      level: "INFO",
      domain: "nav",
      msg: "페이지 진입",
      user_name: "김지나",
      user_email: "jina@example.com",
    });
  });

  it("RLS 미인가(만료 세션) 빈 payload({}) → null", () => {
    expect(parseWorklogRow({})).toBeNull();
  });

  it("필수 필드(level/domain/msg) 일부 누락 → null", () => {
    expect(parseWorklogRow({ level: "INFO" })).toBeNull();
    expect(parseWorklogRow({ level: "INFO", domain: "nav" })).toBeNull();
    expect(parseWorklogRow({ domain: "nav", msg: "m" })).toBeNull();
  });

  it("object가 아닌 입력(null/undefined) → null", () => {
    expect(parseWorklogRow(null)).toBeNull();
    expect(parseWorklogRow(undefined)).toBeNull();
  });

  it("user_name/user_email 없는 정상 payload → row 반환", () => {
    const row = parseWorklogRow({ level: "DEBUG", domain: "sys", msg: "ok" });
    expect(row).not.toBeNull();
    expect(formatWorklogConsoleLine(row!).text).toBe("[SYS] ok");
  });
});

describe("formatWorklogConsoleLine", () => {
  it("INFO level → type=info, 도메인 대문자 + msg 조합", () => {
    const result = formatWorklogConsoleLine({
      level: "INFO",
      domain: "handover",
      msg: "인수인계 등록 완료",
    });
    expect(result.type).toBe("info");
    expect(result.text).toBe("[HANDOVER] 인수인계 등록 완료");
  });

  it("WARN level → type=warn", () => {
    const result = formatWorklogConsoleLine({
      level: "WARN",
      domain: "cron",
      msg: "quota 초과",
    });
    expect(result.type).toBe("warn");
    expect(result.text).toBe("[CRON] quota 초과");
  });

  it("ERROR level → type=err", () => {
    const result = formatWorklogConsoleLine({
      level: "ERROR",
      domain: "auth",
      msg: "SSO 오류",
    });
    expect(result.type).toBe("err");
    expect(result.text).toBe("[AUTH] SSO 오류");
  });

  it("DEBUG level → type=debug (muted cream)", () => {
    const result = formatWorklogConsoleLine({
      level: "DEBUG",
      domain: "sys",
      msg: "page enter",
    });
    expect(result.type).toBe("debug");
    expect(result.text).toBe("[SYS] page enter");
  });

  it("user_name 있으면 [DOMAIN] {이름} · {msg}", () => {
    const result = formatWorklogConsoleLine({
      level: "INFO",
      domain: "nav",
      msg: "페이지 진입 — 운영부 달력",
      user_name: "김지나",
    });
    expect(result.text).toBe("[NAV] 김지나 · 페이지 진입 — 운영부 달력");
  });

  it("user_name 없으면 이름 없이 [DOMAIN] {msg}", () => {
    const result = formatWorklogConsoleLine({
      level: "INFO",
      domain: "cron",
      msg: "스케줄러 대기",
    });
    expect(result.text).toBe("[CRON] 스케줄러 대기");
  });
});

describe("formatIncidentToast", () => {
  it("title 앞에 [사고] prefix + type=warn", () => {
    const result = formatIncidentToast({ title: "Redis 세션 장애" });
    expect(result.text).toBe("[사고] Redis 세션 장애");
    expect(result.type).toBe("warn");
  });

  it("owner_email 없어도 동작", () => {
    const result = formatIncidentToast({
      title: "서버 다운",
      owner_email: null,
    });
    expect(result.text).toBe("[사고] 서버 다운");
    expect(result.type).toBe("warn");
  });
});

describe("formatTodoToast", () => {
  it("[할일] prefix + title + type=info", () => {
    const result = formatTodoToast({ title: "대학 연락망 동기화" });
    expect(result.text).toBe("[할일] 대학 연락망 동기화");
    expect(result.type).toBe("info");
  });

  it("owner_email 없어도 동작", () => {
    const result = formatTodoToast({ title: "문서 정리", owner_email: null });
    expect(result.text).toBe("[할일] 문서 정리");
    expect(result.type).toBe("info");
  });
});

describe("formatBackupRequestToast", () => {
  it("[백업] prefix + summary_md 30자 이내 + type=info", () => {
    const result = formatBackupRequestToast({
      summary_md: "마이그레이션 전 백업 스케줄 등록",
      requester_email: "user@example.com",
    });
    expect(result.text).toBe("[백업] 마이그레이션 전 백업 스케줄 등록");
    expect(result.type).toBe("info");
  });

  it("summary_md 30자 초과 시 30자 slice", () => {
    const long = "가".repeat(35);
    const result = formatBackupRequestToast({
      summary_md: long,
      requester_email: "user@example.com",
    });
    expect(result.text).toBe(`[백업] ${"가".repeat(30)}`);
  });
});

describe("formatDataRequestSendToast", () => {
  it("status=sent → [자료요청] {university_name} 발송 + type=info", () => {
    const result = formatDataRequestSendToast({
      university_name: "중앙대학교",
      status: "sent",
      created_by_email: "user@example.com",
    });
    expect(result).not.toBeNull();
    expect(result!.text).toBe("[자료요청] 중앙대학교 발송");
    expect(result!.type).toBe("info");
  });

  it("status=failed → [자료요청] {university_name} 발송 실패 + type=err", () => {
    const result = formatDataRequestSendToast({
      university_name: "한양대학교",
      status: "failed",
      created_by_email: "user@example.com",
    });
    expect(result).not.toBeNull();
    expect(result!.text).toBe("[자료요청] 한양대학교 발송 실패");
    expect(result!.type).toBe("err");
  });

  it("status=pending → null 반환", () => {
    const result = formatDataRequestSendToast({
      university_name: "서울대학교",
      status: "pending",
      created_by_email: "user@example.com",
    });
    expect(result).toBeNull();
  });

  it("알 수 없는 status → null 반환", () => {
    const result = formatDataRequestSendToast({
      university_name: "연세대학교",
      status: "unknown",
      created_by_email: "user@example.com",
    });
    expect(result).toBeNull();
  });
});

describe("formatHandoverToast", () => {
  it("[인수인계] author_name 등록 + type=info", () => {
    const result = formatHandoverToast({
      author_name: "홍길동",
      author_email: "hong@example.com",
      service_id: "abc-123",
    });
    expect(result.text).toBe("[인수인계] 홍길동 등록");
    expect(result.type).toBe("info");
  });

  it("author_name이 빈 문자열이어도 구조 유지", () => {
    const result = formatHandoverToast({
      author_name: "",
      author_email: "hong@example.com",
      service_id: "abc-123",
    });
    expect(result.text).toBe("[인수인계]  등록");
    expect(result.type).toBe("info");
  });
});
