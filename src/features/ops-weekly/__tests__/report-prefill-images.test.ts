import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeAdmin } from "./fake-admin";

vi.mock("server-only", () => ({}));

let db: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => db.client,
}));

import { opsWeeklyImagePrefix, toStoredNoteHtml } from "../note-images";
import { ensureReport } from "../report-queries";

// 지난주 차주 HTML 의 그림은 지난주 보고서 경로에 있다. 그대로 가져오면 이번 보고서의 첫 저장이
// 접두사 밖 경로라며 조용히 지운다 — 미리 채울 때 새 보고서 경로로 복사하고 경로를 바꾼다.
const SP = "https://sb.test/storage/v1/object/sign/ops-weekly/";
const OLD = "2026-11-09/r0/x.png";
const IMG = (p: string) => `<img data-ops-path="${p}" alt="첨부 이미지">`;
const week = (id: string, start: string, status: string) => ({
  id,
  week_start: start,
  label_year: 2026,
  label_month: 11,
  label_week: 2,
  status,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
});
const tables = (nextWeek: string) => ({
  ops_weekly_weeks: [
    week("w0", "2026-11-09", "reported"),
    week("w1", "2026-11-16", "open"),
  ],
  ops_weekly_reports: [
    { id: "r0", week_id: "w0", operator_email: "a@x", status: "submitted" },
  ],
  ops_weekly_project_owners: [{ project_id: "p1", operator_email: "a@x" }],
  ops_weekly_projects: [{ id: "p1", active: true }],
  ops_weekly_project_entries: [
    {
      id: "e0",
      report_id: "r0",
      project_id: "p1",
      stage: "개발",
      this_week: "",
      next_week: nextWeek,
    },
  ],
});
const insertedThisWeek = (): string => {
  const call = db.spies.insert.mock.calls.find(
    ([t]) => t === "ops_weekly_project_entries",
  );
  return (call?.[1] as { this_week: string }[])[0].this_week;
};

beforeEach(() => {
  db = fakeAdmin({});
});

describe("ensureReport — 지난주 그림 미리 채우기", () => {
  it("그림을 새 보고서 경로로 복사하고, 첫 저장 정화를 거쳐도 남는다", async () => {
    db = fakeAdmin(tables(`<p>a</p>${IMG(OLD)}`));
    const rep = await ensureReport("w1", "a@x");
    const prefix = opsWeeklyImagePrefix("2026-11-16", rep.id);
    expect(db.spies.copy).toHaveBeenCalledWith(
      "ops-weekly",
      OLD,
      `${prefix}x.png`,
    );
    const html = insertedThisWeek();
    expect(html).toBe(`<p>a</p>${IMG(`${prefix}x.png`)}`);
    expect(toStoredNoteHtml(html, prefix, SP)).toContain(
      `data-ops-path="${prefix}x.png"`,
    );
  });

  it("복사가 실패한 그림은 빼고 글은 남긴다 — 지워질 참조를 남기지 않는다", async () => {
    db = fakeAdmin(tables(`<p>a</p>${IMG(OLD)}${IMG("2026-11-09/r0/y.png")}`));
    db.spies.copy.mockResolvedValueOnce({
      data: null,
      error: { message: "Object not found" },
    });
    const rep = await ensureReport("w1", "a@x");
    const prefix = opsWeeklyImagePrefix("2026-11-16", rep.id);
    expect(insertedThisWeek()).toBe(`<p>a</p>${IMG(`${prefix}y.png`)}`);
  });

  it("복사 호출이 던져도 보고서 생성은 실패하지 않는다", async () => {
    db = fakeAdmin(tables(`<p>a</p>${IMG(OLD)}`));
    db.spies.copy.mockRejectedValueOnce(new Error("network"));
    const rep = await ensureReport("w1", "a@x");
    expect(rep.week_id).toBe("w1");
    expect(insertedThisWeek()).toBe("<p>a</p>");
  });

  it("그림이 없으면 storage 를 부르지 않는다", async () => {
    db = fakeAdmin(tables("<p>글만</p>"));
    await ensureReport("w1", "a@x");
    expect(db.spies.copy).not.toHaveBeenCalled();
    expect(insertedThisWeek()).toBe("<p>글만</p>");
  });
});
