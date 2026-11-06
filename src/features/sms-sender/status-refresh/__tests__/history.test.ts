import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { OPERATORS } from "@/features/auth/operators";
import type { CurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAILURE_COPY } from "../contract";
import {
  getStatusRefreshView,
  type RequestRow,
  requesterName,
  toHistoryItem,
} from "../history";

const row = (over: Partial<RequestRow>): RequestRow => ({
  id: "r1",
  requested_at: "2026-11-07T01:02:00Z",
  requested_by: "op-a",
  status: "done",
  finished_at: "2026-11-07T01:12:00Z",
  message: null,
  result: null,
  ...over,
});

const step = (step: string, status: string, code: string | null = null) => ({
  step,
  status,
  summary: "요약",
  counts: {},
  error: code ? { code } : null,
  watermark: null,
});

const nameOf = () => "이름";

function mockAdmin(result: { data?: unknown; error?: unknown }) {
  const limit = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);
  return { from, select, order, limit };
}

const me = (over: Partial<CurrentOperator>) =>
  ({
    email: "op-a",
    permission: "member",
    allowedMenus: ["internal-admin"],
    ...over,
  }) as CurrentOperator;

describe("toHistoryItem", () => {
  it("실패 단계는 할 일 문구로", () => {
    const item = toHistoryItem(
      row({
        status: "failed",
        result: {
          version: 1,
          steps: [step("moa", "ok"), step("workbook", "failed", "locked")],
          changes: ["새 번호 2건"],
        },
      }),
      nameOf,
    );
    expect(item.steps).toEqual([
      { label: "Moa 수집", status: "ok", summary: "요약", action: null },
      {
        label: "현황 파일",
        status: "failed",
        summary: "요약",
        action: "누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.",
      },
    ]);
    expect(item.changes).toEqual(["새 번호 2건"]);
    expect(item.note).toBeNull();
    expect(item.requester).toBe("이름");
    expect(item.status).toBe("failed");
  });

  it("건너뛴 단계도 이유를 적는다", () => {
    const item = toHistoryItem(
      row({
        status: "failed",
        result: {
          version: 1,
          steps: [step("workbook", "skipped", "dependency_failed")],
          changes: [],
        },
      }),
      nameOf,
    );
    expect(item.steps[0].action).toBe(FAILURE_COPY.dependency_failed);
  });

  it("결과 없는 실패는 폴러 멈춤 문구", () => {
    const item = toHistoryItem(
      row({ status: "failed", message: "exit 1 — Traceback" }),
      nameOf,
    );
    expect(item.note).toBe(FAILURE_COPY.poller_crashed);
    expect(item.steps).toEqual([]);
  });

  it("대기·진행 중은 결과가 없어도 문구 없음", () => {
    const item = toHistoryItem(
      row({ status: "running", finished_at: null }),
      nameOf,
    );
    expect(item.note).toBeNull();
    expect(item.finishedAt).toBeNull();
  });

  it("깨진 result jsonb 는 단계 없이 일반 문구", () => {
    const item = toHistoryItem(
      row({ status: "failed", result: { version: 2, steps: "x" } }),
      nameOf,
    );
    expect(item.steps).toEqual([]);
    expect(item.changes).toEqual([]);
    expect(item.note).toBe(FAILURE_COPY.unknown);
  });
});

describe("requesterName", () => {
  it("요청자: automation → 자동화, 모르는 값 → 알 수 없음", () => {
    expect(requesterName("automation")).toBe("자동화");
    expect(requesterName("op-zz")).toBe("알 수 없음");
  });

  it("운영자 메일이면 이름 — 대소문자·공백 무시", () => {
    const op = OPERATORS[0];
    expect(requesterName(op.email)).toBe(op.name);
    expect(requesterName(` ${op.email.toUpperCase()} `)).toBe(op.name);
  });
});

describe("getStatusRefreshView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SMS_SENDER_REQUEST_MANAGER_EMAIL", "mgr-x");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("최근 5건을 요청 시각 역순으로", async () => {
    const { from, order, limit } = mockAdmin({ data: [] });
    const view = await getStatusRefreshView(me({}));
    expect(from).toHaveBeenCalledWith("sms_status_refresh_requests");
    expect(order).toHaveBeenCalledWith("requested_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
    expect(view).toEqual({
      canRequest: false,
      active: null,
      history: [],
      loadError: null,
    });
  });

  it("조회 오류는 빈 이력 + loadError, 버튼 권한은 그대로", async () => {
    mockAdmin({ error: { message: "down" } });
    const view = await getStatusRefreshView(me({ permission: "admin" }));
    expect(view).toEqual({
      canRequest: true,
      active: null,
      history: [],
      loadError: "최신화 이력을 읽지 못했습니다.",
    });
  });

  it("담당자는 버튼 권한이 있다", async () => {
    mockAdmin({ data: [] });
    const view = await getStatusRefreshView(me({ email: "mgr-x" }));
    expect(view.canRequest).toBe(true);
  });

  it("pending/running 첫 행이 active", async () => {
    mockAdmin({
      data: [
        row({
          id: "r3",
          status: "running",
          requested_at: "2026-11-07T03:00:00Z",
          finished_at: null,
        }),
        row({ id: "r2", status: "failed" }),
      ],
    });
    const view = await getStatusRefreshView(me({}));
    expect(view.active).toEqual({
      status: "running",
      requestedAt: "2026-11-07T03:00:00Z",
    });
    expect(view.history.map((h) => h.id)).toEqual(["r3", "r2"]);
    expect(view.history[1].requester).toBe("알 수 없음");
  });
});
