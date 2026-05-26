import { describe, it, expect } from "vitest";
import { BACKUP_FILTERS, blankBackupRow } from "../filters";

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
