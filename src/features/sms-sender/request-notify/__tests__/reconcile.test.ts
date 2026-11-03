import { describe, expect, it } from "vitest";
import { reconcile, seedRows } from "../reconcile";
import type { NoticeRow, RequestItem } from "../types";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function item(id: string, status: string): RequestItem {
  return {
    id,
    status,
    university: "테스트대학교",
    kind: "수시",
    serviceId: "1",
    title: "t",
    applicantEmail: null,
    applicantName: null,
    webUrl: null,
  };
}

function row(id: string, over: Partial<NoticeRow> = {}): NoticeRow {
  return {
    item_id: id,
    last_status: "요청",
    new_state: "sent",
    new_attempts: 0,
    new_claimed_at: null,
    done_state: "pending",
    done_attempts: 0,
    done_claimed_at: null,
    ...over,
  };
}

describe("seedRows", () => {
  it("완료 행은 두 알림 모두 seeded", () => {
    const [r] = seedRows([item("a", "완료")]);
    expect(r.done_state).toBe("seeded");
    expect(r.new_state).toBe("seeded");
  });

  it("요청 행은 완료 알림을 pending 으로 남긴다", () => {
    const [r] = seedRows([item("a", "요청")]);
    expect(r.done_state).toBe("pending");
    expect(r.new_state).toBe("seeded");
    expect(r.last_status).toBe("요청");
  });
});

describe("reconcile", () => {
  it("새 행(요청)은 insert + new 하나만 due", () => {
    const r = reconcile([item("a", "요청")], [], NOW);
    expect(r.inserts).toHaveLength(1);
    expect(r.inserts[0].new_state).toBe("pending");
    expect(r.inserts[0].done_state).toBe("pending");
    expect(r.due.map((d) => d.kind)).toEqual(["new"]);
  });

  it("처음 보이는 행이 이미 완료면 new 다음 done", () => {
    const r = reconcile([item("a", "완료")], [], NOW);
    expect(r.due.map((d) => d.kind)).toEqual(["new", "done"]);
  });

  it("요청→완료 전환이면 done due + statusUpdate", () => {
    const r = reconcile([item("a", "완료")], [row("a")], NOW);
    expect(r.statusUpdates).toEqual([{ item_id: "a", last_status: "완료" }]);
    expect(r.due.map((d) => d.kind)).toEqual(["done"]);
  });

  it("done_state sent 인 행은 완료→요청→완료로 돌아와도 due 없음", () => {
    const r = reconcile(
      [item("a", "완료")],
      [row("a", { last_status: "요청", done_state: "sent" })],
      NOW,
    );
    expect(r.due).toEqual([]);
  });

  it("attempts 3 인 pending 칸은 due 에서 빠진다", () => {
    const r = reconcile(
      [item("a", "완료")],
      [row("a", { new_state: "pending", new_attempts: 3, done_attempts: 3 })],
      NOW,
    );
    expect(r.due).toEqual([]);
  });

  it("30분 넘은 sending 은 pending 으로 회수되고 같은 실행에서 due", () => {
    const r = reconcile(
      [item("a", "요청")],
      [row("a", { new_state: "sending", new_attempts: 1, new_claimed_at: minutesAgo(31) })],
      NOW,
    );
    expect(r.recoveries).toEqual([{ item_id: "a", kind: "new", state: "pending" }]);
    expect(r.due).toEqual([{ kind: "new", item: item("a", "요청"), attempts: 1 }]);
  });

  it("30분 넘은 sending 인데 attempts 3 이면 failed 로 회수, due 아님", () => {
    const r = reconcile(
      [item("a", "요청")],
      [row("a", { new_state: "sending", new_attempts: 3, new_claimed_at: minutesAgo(45) })],
      NOW,
    );
    expect(r.recoveries).toEqual([{ item_id: "a", kind: "new", state: "failed" }]);
    expect(r.due).toEqual([]);
  });

  it("30분 안 된 sending 은 건드리지 않는다", () => {
    const r = reconcile(
      [item("a", "요청")],
      [row("a", { new_state: "sending", new_attempts: 1, new_claimed_at: minutesAgo(10) })],
      NOW,
    );
    expect(r.recoveries).toEqual([]);
    expect(r.due).toEqual([]);
  });

  it("목록에서 사라진 행은 무시", () => {
    const r = reconcile([], [row("gone")], NOW);
    expect(r).toEqual({ inserts: [], statusUpdates: [], recoveries: [], due: [] });
  });

  it("입력을 변경하지 않는다", () => {
    const rows = [row("a", { new_state: "sending", new_claimed_at: minutesAgo(40) })];
    const snapshot = JSON.stringify(rows);
    reconcile([item("a", "요청")], rows, NOW);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});
