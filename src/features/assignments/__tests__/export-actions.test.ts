import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentOperator = vi.hoisted(() => vi.fn());
const exportAssignmentsToSheet = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/queries", () => ({ getCurrentOperator }));
vi.mock("../export-write", () => ({ exportAssignmentsToSheet }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { runAssignmentExport } from "../export-actions";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentOperator.mockResolvedValue({ permission: "admin", email: "a@x.com" });
  exportAssignmentsToSheet.mockResolvedValue({
    ok: true,
    dryRun: false,
    rows: 400,
    columns: 24,
  });
});

describe("runAssignmentExport — 권한", () => {
  it("admin 이 아니면 Graph 를 부르지 않는다", async () => {
    getCurrentOperator.mockResolvedValue({ permission: "member", email: "b@x.com" });

    const r = await runAssignmentExport();

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/admin/);
    expect(exportAssignmentsToSheet).not.toHaveBeenCalled();
  });

  it("로그인하지 않았으면 부르지 않는다", async () => {
    getCurrentOperator.mockResolvedValue(null);

    const r = await runAssignmentExport();

    expect(r.ok).toBe(false);
    expect(exportAssignmentsToSheet).not.toHaveBeenCalled();
  });
});

describe("runAssignmentExport — 결과", () => {
  it("성공하면 행·열 수를 사람이 읽을 문장으로 돌려준다", async () => {
    const r = await runAssignmentExport();

    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/400/);
  });

  it("dry run 은 쓰지 않았다는 것이 문장에 드러난다", async () => {
    exportAssignmentsToSheet.mockResolvedValue({
      ok: true,
      dryRun: true,
      rows: 400,
      columns: 24,
    });

    const r = await runAssignmentExport();

    expect(r.ok).toBe(true);
    // 성공 문장이 같으면 사람은 파일에 썼다고 믿는다.
    expect(r.message).toMatch(/쓰지 않|dry|미발송|시험/i);
  });

  it("실패하면 이유를 그대로 싣는다 — 삼키면 왜 안 됐는지 물어볼 곳이 없다", async () => {
    exportAssignmentsToSheet.mockResolvedValue({
      ok: false,
      dryRun: false,
      rows: 0,
      columns: 0,
      error: "원장이 비어 있습니다 — 시트를 통째로 비우지 않습니다",
    });

    const r = await runAssignmentExport();

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/원장이 비어/);
  });
});
