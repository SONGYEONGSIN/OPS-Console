import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock(
  "@/lib/supabase/admin",
  async () => (await import("./actions-fixture")).adminModule,
);
vi.mock(
  "@/features/auth/queries",
  async () => (await import("./actions-fixture")).authModule,
);

import { revalidatePath } from "next/cache";
import {
  addManualItem,
  removeManualItem,
  saveAreaNote,
  saveItemOverride,
} from "../actions";
import {
  getCurrentOperator,
  LOCKED,
  M1,
  M2,
  me,
  NOT_MINE,
  NOTE,
  R,
  resetFixture,
  seed,
  state,
} from "./actions-fixture";

beforeEach(resetFixture);

describe("authorizeReportEdit (actions 를 통해)", () => {
  it("로그인하지 않았으면 거절한다", async () => {
    getCurrentOperator.mockResolvedValue(null);
    expect(await saveAreaNote(NOTE)).toEqual({
      ok: false,
      error: "로그인이 필요합니다.",
    });
  });

  it("없는 보고서는 거절한다", async () => {
    seed({ id: "99999999-9999-4999-8999-999999999999" });
    expect(await saveAreaNote(NOTE)).toEqual({
      ok: false,
      error: "보고서를 찾을 수 없습니다.",
    });
  });

  it("잠긴 주에 들어온 저장은 거절한다 — 화면이 낡았어도", async () => {
    seed({}, { status: "reported" });
    expect(await saveAreaNote(NOTE)).toEqual({ ok: false, error: LOCKED });
    expect(state.db.spies.upsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("남의 보고서는 당번만 고친다", async () => {
    seed({}, { duty_email: "d@x" });
    me("z@x");
    expect(await saveAreaNote(NOTE)).toEqual({ ok: false, error: NOT_MINE });
    me("d@x");
    expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
  });

  it("이메일 대소문자·공백이 달라도 본인·당번으로 본다", async () => {
    seed({}, { duty_email: "D@X" });
    me(" A@X ");
    expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
    me("d@x");
    expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
  });

  it("admin 은 정정으로 다시 연 주에서만 남의 보고서를 고친다", async () => {
    seed({}, { duty_email: "d@x", reopened_at: null });
    me("z@x", true);
    expect(await saveAreaNote(NOTE)).toEqual({ ok: false, error: NOT_MINE });
    seed({}, { duty_email: "d@x", reopened_at: "2026-11-20T01:00:00Z" });
    expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
  });
});

describe("saveAreaNote", () => {
  it("(report_id, area) 로 upsert 하고 작성자를 남긴다", async () => {
    expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
    expect(state.db.spies.upsert).toHaveBeenCalledWith(
      "ops_weekly_area_notes",
      {
        report_id: R,
        area: "application",
        this_week: "x",
        next_week: "",
        updated_by: "a@x",
      },
      { onConflict: "report_id,area" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/ops-weekly");
    // 새 화면 메뉴도 같은 보고서를 보여 준다 — 한쪽만 그리면 다른 쪽이 낡는다.
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/ops-weekly-v2");
  });

  it("입력이 틀리면 쓰지 않는다", async () => {
    const r = await saveAreaNote({ ...NOTE, area: "nope" });
    expect(r.ok).toBe(false);
    expect(state.db.spies.upsert).not.toHaveBeenCalled();
  });

  it("쓰기 에러는 실패로 돌려준다", async () => {
    state.db.failNextWrite("ops_weekly_area_notes", "boom");
    const r = await saveAreaNote(NOTE);
    expect(r.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveItemOverride", () => {
  it("빼기는 그 주 보고서에만 기록한다", async () => {
    expect(
      await saveItemOverride({
        reportId: R,
        itemKey: "closing:9045010",
        area: "application",
        excluded: true,
      }),
    ).toEqual({ ok: true });
    expect(state.db.spies.upsert).toHaveBeenCalledWith(
      "ops_weekly_item_overrides",
      expect.objectContaining({
        report_id: R,
        item_key: "closing:9045010",
        excluded: true,
        updated_by: "a@x",
      }),
      { onConflict: "report_id,item_key" },
    );
  });

  it("모르는 항목 키는 거절한다", async () => {
    const r = await saveItemOverride({
      reportId: R,
      itemKey: "evil:1",
      area: "application",
      excluded: true,
    });
    expect(r.ok).toBe(false);
  });
});

describe("addManualItem / removeManualItem", () => {
  it("직접 추가 — 원서접수는 묶음 키가 필요하고, 휴가는 시작일이 필요하다", async () => {
    expect(
      (
        await addManualItem({
          reportId: R,
          area: "application",
          groupKey: "nope",
          title: "x",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await addManualItem({
          reportId: R,
          area: "leave",
          groupKey: null,
          title: "연차",
        })
      ).ok,
    ).toBe(false);
    const ok = await addManualItem({
      reportId: R,
      area: "application",
      groupKey: "other",
      title: "공공접수 안내",
    });
    expect(ok.ok).toBe(true);
    expect(ok.id).toBe(state.db.rows("ops_weekly_manual_items")[0].id);
    expect(state.db.rows("ops_weekly_manual_items")[0]).toMatchObject({
      report_id: R,
      area: "application",
      group_key: "other",
      title: "공공접수 안내",
      note: "",
      created_by: "a@x",
    });
  });

  it("PIMS 는 PIMS 묶음 키만, 휴가는 시작일이 있으면 받는다", async () => {
    expect(
      (
        await addManualItem({
          reportId: R,
          area: "pims",
          groupKey: "opening",
          title: "x",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await addManualItem({
          reportId: R,
          area: "leave",
          groupKey: null,
          title: "연차",
          periodStart: "2026-11-18",
          leaveKind: "연차",
        })
      ).ok,
    ).toBe(true);
  });

  it("빼기는 그 보고서의 항목만 지운다", async () => {
    seed(
      {},
      {},
      {
        ops_weekly_manual_items: [
          { id: M1, report_id: R, area: "application", title: "a" },
          {
            id: M2,
            report_id: "r-other",
            area: "application",
            title: "b",
          },
        ],
      },
    );
    expect(await removeManualItem({ reportId: R, itemId: M1 })).toEqual({
      ok: true,
    });
    expect(await removeManualItem({ reportId: R, itemId: M2 })).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(state.db.rows("ops_weekly_manual_items").map((r) => r.id)).toEqual([
      M2,
    ]);
  });

  it("남의 보고서 id 로 지우려 하면 판정에서 막힌다", async () => {
    seed(
      {},
      {},
      {
        ops_weekly_manual_items: [
          { id: M1, report_id: R, area: "application", title: "a" },
        ],
      },
    );
    me("z@x");
    expect(await removeManualItem({ reportId: R, itemId: M1 })).toEqual({
      ok: false,
      error: NOT_MINE,
    });
    expect(state.db.rows("ops_weekly_manual_items")).toHaveLength(1);
  });
});
