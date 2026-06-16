import { describe, it, expect } from "vitest";
import {
  BACKUP_FILTERS,
  blankBackupRow,
  buildBackupTitle,
  isAutoBackupTitle,
} from "../filters";

describe("BACKUP_FILTERS", () => {
  it("전체 / 내가 요청 / 내가 백업 / 메일 실패 4개 옵션", () => {
    expect(BACKUP_FILTERS.length).toBe(4);
    expect(BACKUP_FILTERS.map((f) => f.value)).toEqual([
      "all",
      "mine",
      "mine_substitute",
      "mail_failed",
    ]);
    expect(BACKUP_FILTERS.map((f) => f.label)).toEqual([
      "전체",
      "내가 요청",
      "내가 백업",
      "메일 실패",
    ]);
  });
});

describe("blankBackupRow", () => {
  it("status=active, mailStatus=pending, 빈 chips 기본값", () => {
    const row = blankBackupRow({ currentUserName: "Bob" });
    expect(row.status).toBe("active");
    expect(row.mailStatus).toBe("pending");
    expect(row.backupServices).toEqual([]);
    expect(row.backupServicesDetail).toEqual([]);
    expect(row.owner).toBe("Bob");
  });

  it("currentUserName 없으면 owner 빈 문자열", () => {
    const row = blankBackupRow();
    expect(row.owner).toBe("");
  });
});

describe("buildBackupTitle", () => {
  it("{이름} 백업요청(MM.DD~MM.DD) 형식", () => {
    expect(buildBackupTitle("홍길동", "2026-06-16", "2026-06-17")).toBe(
      "홍길동 백업요청(06.16~06.17)",
    );
  });

  it("종료일 없으면 시작일만 (06.16~)", () => {
    expect(buildBackupTitle("홍길동", "2026-06-16", null)).toBe(
      "홍길동 백업요청(06.16~)",
    );
  });

  it("이름 없으면 빈 문자열", () => {
    expect(buildBackupTitle("", "2026-06-16", "2026-06-17")).toBe("");
  });
});

describe("isAutoBackupTitle", () => {
  it("빈 제목 / 자동생성 패턴이면 true", () => {
    expect(isAutoBackupTitle("")).toBe(true);
    expect(isAutoBackupTitle("홍길동 백업요청(06.16~06.17)")).toBe(true);
  });

  it("수동 제목이면 false (덮어쓰지 않음)", () => {
    expect(isAutoBackupTitle("긴급 출장 대체")).toBe(false);
  });
});
