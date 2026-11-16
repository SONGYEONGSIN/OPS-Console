/**
 * 테스트 도우미(*.test.ts 아님) — actions 테스트 두 파일이 같은 목·시드를 쓴다.
 * 테스트 파일에서: `vi.mock("@/lib/supabase/admin", async () => (await import("./actions-fixture")).adminModule)`
 *                 `vi.mock("@/features/auth/queries", async () => (await import("./actions-fixture")).authModule)`
 *                 `beforeEach(resetFixture)`
 */
import { vi, type Mock } from "vitest";
import { fakeAdmin, type Row } from "./fake-admin";

export const uploadSpy: Mock = vi.fn();
export const createSignedUrlSpy: Mock = vi.fn();
export const storageFromSpy: Mock = vi.fn(() => ({
  upload: uploadSpy,
  createSignedUrl: createSignedUrlSpy,
}));
export const getCurrentOperator: Mock = vi.fn();

export const state: { db: ReturnType<typeof fakeAdmin> } = {
  db: fakeAdmin({}),
};

export const adminModule = {
  createAdminClient: () => ({
    ...state.db.client,
    storage: { from: storageFromSpy },
  }),
};
export const authModule = {
  getCurrentOperator: () => getCurrentOperator(),
};

export const R = "11111111-1111-4111-8111-111111111111";
export const W = "22222222-2222-4222-8222-222222222222";
export const P1 = "33333333-3333-4333-8333-333333333333";
export const M1 = "44444444-4444-4444-8444-444444444444";
export const M2 = "55555555-5555-4555-8555-555555555555";
export const NOTE = {
  reportId: R,
  area: "application",
  thisWeek: "x",
  nextWeek: "",
};
export const LOCKED = "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.";
export const NOT_MINE = "본인 보고서만 수정할 수 있습니다.";

/** 디코드하면 정확히 n 바이트인 png data URL. */
export const pngOf = (n: number) =>
  `data:image/png;base64,${Buffer.alloc(n).toString("base64")}`;

export function me(email: string, admin = false) {
  getCurrentOperator.mockResolvedValue({
    email,
    operator: null,
    displayName: email,
    role: "사원",
    team: null,
    permission: admin ? "admin" : "member",
    allowedMenus: [],
  });
}

export function seed(
  report: Row = {},
  week: Row = {},
  extra: Record<string, Row[]> = {},
) {
  state.db = fakeAdmin({
    ops_weekly_reports: [
      {
        id: R,
        week_id: W,
        operator_email: "a@x",
        status: "draft",
        submitted_at: null,
        returned_at: null,
        returned_by: null,
        return_reason: null,
        snapshot: null,
        checked_tabs: [],
        ...report,
      },
    ],
    ops_weekly_weeks: [
      {
        id: W,
        week_start: "2026-11-16",
        label_year: 2026,
        label_month: 11,
        label_week: 3,
        duty_email: null,
        summary_this: "",
        summary_next: "",
        status: "open",
        reported_at: null,
        reported_by: null,
        reopened_at: null,
        reopened_by: null,
        ...week,
      },
    ],
    ...extra,
  });
}

/** P1 의 담당자·활성 여부와 그 보고서의 entry 한 줄. */
export const owner = (email = "a@x", active = true): Record<string, Row[]> => ({
  ops_weekly_projects: [{ id: P1, name: "프로젝트A", kind: "project", active }],
  ops_weekly_project_owners: [{ project_id: P1, operator_email: email }],
  ops_weekly_project_entries: [
    {
      id: "e1",
      report_id: R,
      project_id: P1,
      stage: null,
      this_week: "",
      next_week: "",
    },
  ],
});

export function resetFixture() {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test");
  uploadSpy.mockResolvedValue({ data: { path: "x" }, error: null });
  createSignedUrlSpy.mockResolvedValue({
    data: { signedUrl: "https://signed/up" },
    error: null,
  });
  me("a@x");
  seed();
}
