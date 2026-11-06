import { describe, expect, it } from "vitest";
import type { RawDocFile } from "../../types";
import { isManager, reconcileUploads, seedUploadRows } from "../reconcile";
import type { UploadRow } from "../types";

const MANAGER = "manager@example.test";
const OTHER = "other@example.test";
const now = new Date("2026-11-06T01:00:00Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60_000).toISOString();

const file = (over: Partial<RawDocFile> = {}): RawDocFile => ({
  id: "f1",
  name: "(가나대학교) 서류.pdf",
  folder: "진행 중",
  webUrl: "https://example.invalid/f1",
  hash: "h1",
  createdByEmail: OTHER,
  modifiedByEmail: OTHER,
  ...over,
});

const row = (over: Partial<UploadRow> = {}): UploadRow => ({
  item_id: "f1",
  name: "(가나대학교) 서류.pdf",
  folder_path: "진행 중",
  web_url: "https://example.invalid/f1",
  content_hash: "h1",
  change_kind: "new",
  state: "sent",
  attempts: 1,
  claimed_at: null,
  ...over,
});

const run = (files: RawDocFile[], rows: UploadRow[]) =>
  reconcileUploads(files, rows, MANAGER, now);

const empty = {
  inserts: [],
  rearms: [],
  fills: [],
  hashUpdates: [],
  recoveries: [],
  due: [],
  skippedSelf: 0,
};

describe("seedUploadRows", () => {
  it("seedUploadRows 는 전부 seeded", () => {
    const rows = seedUploadRows([
      file(),
      file({ id: "f2", name: "memo.txt", folder: "" }),
    ]);
    expect(rows).toEqual([
      {
        item_id: "f1",
        name: "(가나대학교) 서류.pdf",
        folder_path: "진행 중",
        web_url: "https://example.invalid/f1",
        content_hash: "h1",
        change_kind: "new",
        state: "seeded",
        attempts: 0,
      },
      expect.objectContaining({
        item_id: "f2",
        folder_path: "",
        state: "seeded",
      }),
    ]);
  });
});

describe("isManager", () => {
  it("trim·소문자로 비교하고 null 은 아니다", () => {
    expect(isManager(" Manager@Example.TEST ", MANAGER)).toBe(true);
    expect(isManager(MANAGER, " MANAGER@example.test ")).toBe(true);
    expect(isManager(OTHER, MANAGER)).toBe(false);
    expect(isManager(null, MANAGER)).toBe(false);
  });
});

describe("reconcileUploads — 새 파일", () => {
  it("처음 보는 id 는 pending insert + due(new)", () => {
    const f = file();
    const plan = run([f], []);
    expect(plan.inserts).toEqual([
      expect.objectContaining({
        item_id: "f1",
        state: "pending",
        change_kind: "new",
        attempts: 0,
      }),
    ]);
    expect(plan.due).toEqual([{ file: f, kind: "new", attempts: 0 }]);
    expect(plan.skippedSelf).toBe(0);
  });
  it("처음 보는 id 를 담당자가 올렸으면 skipped_self, due 없음, skippedSelf 1", () => {
    const plan = run([file({ createdByEmail: MANAGER })], []);
    expect(plan.inserts[0]).toMatchObject({ state: "skipped_self" });
    expect(plan.due).toEqual([]);
    expect(plan.skippedSelf).toBe(1);
  });
  it("담당자 메일 대소문자·공백이 달라도 본인", () => {
    const plan = run([file({ createdByEmail: " Manager@Example.TEST " })], []);
    expect(plan.inserts[0]).toMatchObject({ state: "skipped_self" });
    expect(plan.due).toEqual([]);
  });
  it("새 파일은 createdBy 가 없으면 lastModifiedBy 로 본다", () => {
    const plan = run(
      [file({ createdByEmail: null, modifiedByEmail: MANAGER })],
      [],
    );
    expect(plan.inserts[0]).toMatchObject({ state: "skipped_self" });
  });
  it("올린 사람 메일이 없으면 알린다", () => {
    const plan = run(
      [file({ createdByEmail: null, modifiedByEmail: null })],
      [],
    );
    expect(plan.inserts[0]).toMatchObject({ state: "pending" });
    expect(plan.due).toHaveLength(1);
  });
  it("PDF 가 아닌 새 파일도 알린다", () => {
    const f = file({ name: "memo.xlsx" });
    const plan = run([f], []);
    expect(plan.inserts[0]).toMatchObject({
      state: "pending",
      change_kind: "new",
    });
    expect(plan.due).toEqual([{ file: f, kind: "new", attempts: 0 }]);
  });
});

describe("reconcileUploads — 교체", () => {
  it("같은 id 새 해시 → rearm(replaced) + due(replaced, attempts 0)", () => {
    const f = file({ hash: "h2", folder: "완료/검토완료" });
    const plan = run([f], [row({ state: "sent", attempts: 1 })]);
    expect(plan.rearms).toEqual([
      {
        item_id: "f1",
        prevHash: "h1",
        name: f.name,
        folder_path: "완료/검토완료",
        web_url: f.webUrl,
        content_hash: "h2",
        change_kind: "replaced",
        state: "pending",
      },
    ]);
    expect(plan.due).toEqual([{ file: f, kind: "replaced", attempts: 0 }]);
  });
  it("교체를 담당자가 했으면 skipped_self rearm, due 없음", () => {
    const plan = run(
      [file({ hash: "h2", createdByEmail: OTHER, modifiedByEmail: MANAGER })],
      [row()],
    );
    expect(plan.rearms[0]).toMatchObject({
      state: "skipped_self",
      change_kind: "replaced",
    });
    expect(plan.due).toEqual([]);
    expect(plan.skippedSelf).toBe(1);
  });
  it("교체는 createdBy 가 담당자여도 lastModifiedBy 로 본다", () => {
    const plan = run(
      [file({ hash: "h2", createdByEmail: MANAGER, modifiedByEmail: OTHER })],
      [row()],
    );
    expect(plan.rearms[0]).toMatchObject({ state: "pending" });
    expect(plan.due).toHaveLength(1);
  });
  it("아직 안 나간 pending 행의 교체는 change_kind new 유지", () => {
    const f = file({ hash: "h2" });
    const plan = run(
      [f],
      [row({ state: "pending", attempts: 1, change_kind: "new" })],
    );
    expect(plan.rearms[0]).toMatchObject({
      change_kind: "new",
      state: "pending",
    });
    expect(plan.due).toEqual([{ file: f, kind: "new", attempts: 0 }]);
  });
  it("해시만 같고 폴더가 바뀌면(이동) 아무 일도 없다", () => {
    const plan = run([file({ folder: "완료/제출완료" })], [row()]);
    expect(plan).toEqual(empty);
  });
  it("PDF 대문자 확장자도 교체로 본다", () => {
    const plan = run(
      [file({ name: "A.PDF", hash: "h2" })],
      [row({ name: "A.PDF" })],
    );
    expect(plan.rearms).toHaveLength(1);
  });
});

describe("reconcileUploads — PDF 가 아닌 파일의 해시 변경", () => {
  it(".xlsx 해시가 바뀌면 해시만 갱신하고 알리지 않는다", () => {
    const plan = run(
      [file({ name: "목록.xlsx", hash: "h2" })],
      [row({ name: "목록.xlsx", state: "sent" })],
    );
    expect(plan.hashUpdates).toEqual([
      { item_id: "f1", prevHash: "h1", content_hash: "h2" },
    ]);
    expect(plan.rearms).toEqual([]);
    expect(plan.due).toEqual([]);
  });
  it("아직 안 나간 새 .xlsx 는 해시만 바꾸고 원래 알림은 그대로 나간다", () => {
    const f = file({ name: "목록.xlsx", hash: "h2" });
    const plan = run(
      [f],
      [row({ name: "목록.xlsx", state: "pending", attempts: 1 })],
    );
    expect(plan.hashUpdates).toHaveLength(1);
    expect(plan.rearms).toEqual([]);
    expect(plan.due).toEqual([{ file: f, kind: "new", attempts: 1 }]);
  });
  it("PDF 해시가 바뀌면 교체 — pending 으로 무장", () => {
    const plan = run([file({ hash: "h2" })], [row({ state: "sent" })]);
    expect(plan.hashUpdates).toEqual([]);
    expect(plan.rearms[0]).toMatchObject({
      change_kind: "replaced",
      state: "pending",
    });
  });
});

describe("reconcileUploads — 해시 null", () => {
  it("해시 null — 저장 null·새 값 있음은 fill 만, 알림 없음", () => {
    const plan = run([file({ hash: "h2" })], [row({ content_hash: null })]);
    expect(plan.fills).toEqual([{ item_id: "f1", content_hash: "h2" }]);
    expect(plan.rearms).toEqual([]);
    expect(plan.due).toEqual([]);
  });
  it("해시 null — 새 값 null 이면 비교하지 않는다", () => {
    const plan = run([file({ hash: null })], [row({ content_hash: "h1" })]);
    expect(plan).toEqual(empty);
  });
  it("저장 null 인 pending 행은 채우고 원래 알림은 그대로 나간다", () => {
    const f = file({ hash: "h2" });
    const plan = run(
      [f],
      [row({ content_hash: null, state: "pending", attempts: 0 })],
    );
    expect(plan.fills).toHaveLength(1);
    expect(plan.due).toEqual([{ file: f, kind: "new", attempts: 0 }]);
  });
});

describe("reconcileUploads — sending·재시도", () => {
  it("sending 중 교체는 다음 실행으로", () => {
    const plan = run(
      [file({ hash: "h2" })],
      [row({ state: "sending", attempts: 1, claimed_at: minutesAgo(5) })],
    );
    expect(plan).toEqual(empty);
  });
  it("30분 지난 sending 은 회수 — attempts 3 이면 failed, 1 이면 pending + due", () => {
    const fa = file({ id: "a" });
    const fb = file({ id: "b" });
    const plan = run(
      [fa, fb],
      [
        row({
          item_id: "a",
          state: "sending",
          attempts: 3,
          claimed_at: minutesAgo(31),
        }),
        row({
          item_id: "b",
          state: "sending",
          attempts: 1,
          change_kind: "replaced",
          claimed_at: minutesAgo(31),
        }),
      ],
    );
    expect(plan.recoveries).toEqual([
      { item_id: "a", state: "failed" },
      { item_id: "b", state: "pending" },
    ]);
    expect(plan.due).toEqual([{ file: fb, kind: "replaced", attempts: 1 }]);
  });
  it("pending 이지만 attempts 3 이면 due 아님", () => {
    const plan = run([file()], [row({ state: "pending", attempts: 3 })]);
    expect(plan.due).toEqual([]);
  });
  it("pending 이고 attempts 가 남았으면 행의 attempts·change_kind 로 due", () => {
    const f = file();
    const plan = run(
      [f],
      [row({ state: "pending", attempts: 2, change_kind: "replaced" })],
    );
    expect(plan.due).toEqual([{ file: f, kind: "replaced", attempts: 2 }]);
  });
  it("sent·seeded·failed 행은 due 아님", () => {
    for (const state of [
      "sent",
      "seeded",
      "failed",
      "skipped_self",
      "dry_run",
    ] as const) {
      expect(run([file()], [row({ state })]).due).toEqual([]);
    }
  });
  it("DB 에만 있는 행은 무시하고 인자를 고치지 않는다", () => {
    const files = [file()];
    const rows = [
      row({ item_id: "gone", state: "pending", attempts: 0 }),
      row(),
    ];
    const snapshot = JSON.stringify({ files, rows });
    const plan = run(files, rows);
    expect(plan).toEqual(empty);
    expect(JSON.stringify({ files, rows })).toBe(snapshot);
  });
});
