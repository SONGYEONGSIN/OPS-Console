import { describe, it, expect } from "vitest";
import { BACKUP_FILTERS, blankBackupRow } from "../filters";

describe("BACKUP_FILTERS", () => {
  it("전체 / 내가 등록 / 메일 실패 3개 옵션", () => {
    expect(BACKUP_FILTERS.length).toBe(3);
    expect(BACKUP_FILTERS.map((f) => f.value)).toEqual([
      "all",
      "mine",
      "mail_failed",
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
