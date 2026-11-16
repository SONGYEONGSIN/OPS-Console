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

import {
  markTabChecked,
  saveProjectEntry,
  uploadWeeklyImage,
} from "../actions";
import {
  createSignedUrlSpy,
  LOCKED,
  me,
  owner,
  P1,
  pngOf,
  R,
  resetFixture,
  seed,
  state,
  storageFromSpy,
  uploadSpy,
} from "./actions-fixture";

beforeEach(resetFixture);

describe("saveProjectEntry", () => {
  it("프로젝트 HTML 은 정화한다 — 외부 이미지·스크립트 제거, 서명 URL 은 경로로", async () => {
    seed({}, {}, owner());
    expect(
      await saveProjectEntry({
        reportId: R,
        projectId: P1,
        stage: "개발",
        thisWeek: `<p>ok</p><script>x</script><img src="https://evil/x.png"><img src="https://sb.test/storage/v1/object/sign/ops-weekly/2026-11-16/${R}/a.png?token=t">`,
        nextWeek: "",
      }),
    ).toEqual({ ok: true });
    const [table, patch] = state.db.spies.update.mock.calls[0];
    expect(table).toBe("ops_weekly_project_entries");
    expect(patch).toEqual({
      stage: "개발",
      this_week: `<p>ok</p><img data-ops-path="2026-11-16/${R}/a.png" alt="첨부 이미지">`,
      next_week: "",
      updated_by: "a@x",
    });
    expect(state.db.rows("ops_weekly_project_entries")[0].stage).toBe("개발");
  });

  it("맡지 않은 프로젝트는 쓸 수 없다", async () => {
    expect(
      await saveProjectEntry({
        reportId: R,
        projectId: P1,
        stage: null,
        thisWeek: "",
        nextWeek: "",
      }),
    ).toEqual({ ok: false, error: "담당 항목이 아닙니다." });
    expect(state.db.spies.update).not.toHaveBeenCalled();
  });

  it("담당 판정은 작성자가 아니라 보고서 주인으로 한다(당번이 고칠 때)", async () => {
    seed({}, { duty_email: "d@x" }, owner("a@x"));
    me("d@x");
    expect(
      (
        await saveProjectEntry({
          reportId: R,
          projectId: P1,
          stage: null,
          thisWeek: "<p>d</p>",
          nextWeek: "",
        })
      ).ok,
    ).toBe(true);
  });

  it("정화한 뒤에도 50,000자를 넘으면 거절한다", async () => {
    seed({}, {}, owner());
    const r = await saveProjectEntry({
      reportId: R,
      projectId: P1,
      stage: null,
      thisWeek: `<p>${"가".repeat(50_001)}</p>`,
      nextWeek: "",
    });
    expect(r.ok).toBe(false);
    expect(state.db.spies.update).not.toHaveBeenCalled();
  });

  it("정화 전 입력이 200,000자를 넘으면 정화하지 않고 거절한다", async () => {
    seed({}, {}, owner());
    // 정화하면 빈 문자열이 되는 입력 — 정화 후 길이 검사로는 못 막는다.
    const junk = '<img src="https://evil/x.png">'.repeat(7_000);
    expect(junk.length).toBeGreaterThan(200_000);
    for (const [thisWeek, nextWeek] of [
      [junk, ""],
      ["", junk],
    ]) {
      const r = await saveProjectEntry({
        reportId: R,
        projectId: P1,
        stage: null,
        thisWeek,
        nextWeek,
      });
      expect(r).toEqual({
        ok: false,
        error: "내용이 너무 깁니다(200,000자 이하).",
      });
    }
    expect(state.db.spies.update).not.toHaveBeenCalled();
  });

  it("base64 그림은 길이 검사 전에 지워진다", async () => {
    seed({}, {}, owner());
    const r = await saveProjectEntry({
      reportId: R,
      projectId: P1,
      stage: null,
      thisWeek: `<p>a</p><img src="${pngOf(60_000)}">`,
      nextWeek: "",
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("uploadWeeklyImage", () => {
  it("그림 — 이미지 아님 거절", async () => {
    seed({}, {}, owner());
    expect(
      await uploadWeeklyImage({
        reportId: R,
        dataUrl: "data:text/plain;base64,AA==",
      }),
    ).toEqual({ ok: false, error: "이미지 형식이 아닙니다." });
  });

  it("그림 — 5MB 경계: 5,242,880 바이트는 받고 5,242,881 은 거절", async () => {
    seed({}, {}, owner());
    expect(
      await uploadWeeklyImage({
        reportId: R,
        dataUrl: pngOf(5 * 1024 * 1024 + 1),
      }),
    ).toEqual({
      ok: false,
      error: "이미지 크기가 유효하지 않습니다(5MB 이하).",
    });
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(
      (
        await uploadWeeklyImage({
          reportId: R,
          dataUrl: pngOf(5 * 1024 * 1024),
        })
      ).ok,
    ).toBe(true);
  });

  it("그림 — 성공하면 그 보고서 접두사 아래에 올리고 1시간 서명 URL 을 돌려준다", async () => {
    seed({}, {}, owner());
    expect(
      await uploadWeeklyImage({ reportId: R, dataUrl: pngOf(10) }),
    ).toEqual({ ok: true, url: "https://signed/up" });
    const [path, buf, opts] = uploadSpy.mock.calls[0];
    expect(path).toMatch(new RegExp(`^2026-11-16/${R}/[0-9a-f-]{36}\\.png$`));
    expect((buf as Buffer).length).toBe(10);
    expect(opts).toEqual({ contentType: "image/png", upsert: false });
    expect(createSignedUrlSpy).toHaveBeenCalledWith(path, 3600);
    expect(storageFromSpy).toHaveBeenCalledWith("ops-weekly");
  });

  it("그림 — 프로젝트 담당이 없으면 거절", async () => {
    expect(
      await uploadWeeklyImage({ reportId: R, dataUrl: pngOf(10) }),
    ).toEqual({ ok: false, error: "그림은 프로젝트·TF에만 붙일 수 있습니다." });
    seed({}, {}, owner("a@x", false));
    expect(
      await uploadWeeklyImage({ reportId: R, dataUrl: pngOf(10) }),
    ).toEqual({ ok: false, error: "그림은 프로젝트·TF에만 붙일 수 있습니다." });
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("그림 — 잠긴 주에서는 올리지 않는다", async () => {
    seed({}, { status: "reported" }, owner());
    expect(
      await uploadWeeklyImage({ reportId: R, dataUrl: pngOf(10) }),
    ).toEqual({ ok: false, error: LOCKED });
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("그림 — 업로드 에러는 실패로 돌려준다", async () => {
    seed({}, {}, owner());
    uploadSpy.mockResolvedValueOnce({ data: null, error: { message: "full" } });
    const r = await uploadWeeklyImage({ reportId: R, dataUrl: pngOf(10) });
    expect(r.ok).toBe(false);
    expect(createSignedUrlSpy).not.toHaveBeenCalled();
  });
});

describe("markTabChecked", () => {
  it("없으면 더하고, 있으면 그대로 둔다", async () => {
    seed({ checked_tabs: ["pims"] });
    expect(await markTabChecked({ reportId: R, area: "application" })).toEqual({
      ok: true,
    });
    expect(state.db.rows("ops_weekly_reports")[0].checked_tabs).toEqual([
      "pims",
      "application",
    ]);
    expect(state.db.spies.update).toHaveBeenCalledWith("ops_weekly_reports", {
      checked_tabs: ["pims", "application"],
      updated_by: "a@x",
    });
    vi.clearAllMocks();
    expect(await markTabChecked({ reportId: R, area: "pims" })).toEqual({
      ok: true,
    });
    expect(state.db.spies.update).not.toHaveBeenCalled();
  });
});
