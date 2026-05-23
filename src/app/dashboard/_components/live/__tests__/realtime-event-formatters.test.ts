import { describe, it, expect } from "vitest";
import {
  formatWorklogConsoleLine,
  formatIncidentToast,
  formatTodoToast,
  formatBackupRequestToast,
  formatDataRequestSendToast,
} from "../realtime-event-formatters";

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

  it("DEBUG level → type=info (fallback)", () => {
    const result = formatWorklogConsoleLine({
      level: "DEBUG",
      domain: "sys",
      msg: "page enter",
    });
    expect(result.type).toBe("info");
    expect(result.text).toBe("[SYS] page enter");
  });
});

describe("formatIncidentToast", () => {
  it("title 앞에 [사고] prefix + type=warn", () => {
    const result = formatIncidentToast({ title: "Redis 세션 장애" });
    expect(result.text).toBe("[사고] Redis 세션 장애");
    expect(result.type).toBe("warn");
  });

  it("owner_email 없어도 동작", () => {
    const result = formatIncidentToast({ title: "서버 다운", owner_email: null });
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
