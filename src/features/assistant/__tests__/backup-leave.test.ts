import { describe, it, expect } from "vitest";
import { parseBackupTitle, backupLeavesInRange } from "../backup-leave";

describe("parseBackupTitle", () => {
  it("이름·사유·기간을 뽑는다", () => {
    expect(parseBackupTitle("임종우 연차 백업요청(08.18~08.21)", 2026)).toEqual({
      name: "임종우",
      reason: "연차",
      startYmd: "2026-08-18",
      endYmd: "2026-08-21",
    });
  });

  it("하루짜리도 읽는다", () => {
    const r = parseBackupTitle("김지현 연차 백업요청(08.14~08.14)", 2026);
    expect(r?.startYmd).toBe("2026-08-14");
    expect(r?.endYmd).toBe("2026-08-14");
  });

  it("외근도 사유로 읽는다 — 부재는 맞지만 휴가는 아니다", () => {
    expect(parseBackupTitle("김지나 외근 백업요청(08.12~08.12)", 2026)?.reason).toBe(
      "외근",
    );
  });

  it("형식이 다르면 null — 억지로 읽어 엉뚱한 사람을 만들지 않는다", () => {
    expect(parseBackupTitle("백업요청", 2026)).toBeNull();
    expect(parseBackupTitle("", 2026)).toBeNull();
  });

  /**
   * 제목에 연도가 없다. 12월에 만든 요청이 1월 기간을 가리키면 해가 넘어간다 —
   * 시작보다 끝이 앞서면 끝을 다음 해로 본다.
   */
  it("연말에 걸치면 끝을 다음 해로 본다", () => {
    const r = parseBackupTitle("아무개 연차 백업요청(12.30~01.02)", 2026);
    expect(r?.startYmd).toBe("2026-12-30");
    expect(r?.endYmd).toBe("2027-01-02");
  });
});

describe("backupLeavesInRange", () => {
  const rows = [
    { title: "임종우 연차 백업요청(08.18~08.21)", created_at: "2026-06-22T00:00:00Z" },
    { title: "이해영 연차 백업요청(08.20~08.21)", created_at: "2026-08-19T00:00:00Z" },
    { title: "김지나 외근 백업요청(08.12~08.12)", created_at: "2026-08-11T00:00:00Z" },
    { title: "박시현 연차 백업요청(06.19~06.23)", created_at: "2026-06-18T00:00:00Z" },
  ];

  it("기간에 걸치는 연차만 돌려준다", () => {
    const r = backupLeavesInRange(rows, "2026-08-17", "2026-08-23");
    expect(r.map((x) => x.name)).toEqual(["임종우", "이해영"]);
  });

  it("외근은 빼지 않는다 — 부재는 부재라 알아야 한다. 다만 사유를 붙인다", () => {
    const r = backupLeavesInRange(rows, "2026-08-10", "2026-08-14");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "김지나", reason: "외근" });
  });

  it("기간이 걸치기만 해도 넣는다 — 하루라도 겹치면 그 주 부재자다", () => {
    // 8/18~8/21 중 8/21만 걸치는 범위
    const r = backupLeavesInRange(rows, "2026-08-21", "2026-08-25");
    expect(r.map((x) => x.name)).toContain("임종우");
  });

  it("범위 밖은 뺀다", () => {
    expect(backupLeavesInRange(rows, "2026-09-01", "2026-09-07")).toEqual([]);
  });

  it("읽을 수 없는 제목은 건너뛴다", () => {
    const r = backupLeavesInRange(
      [{ title: "이상한 제목", created_at: "2026-08-19T00:00:00Z" }],
      "2026-08-17",
      "2026-08-23",
    );
    expect(r).toEqual([]);
  });
});
