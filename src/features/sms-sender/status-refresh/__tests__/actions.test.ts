import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../enqueue", () => ({ enqueueStatusRefresh: vi.fn() }));

import { getCurrentOperator } from "@/features/auth/queries";
import { revalidatePath } from "next/cache";
import { enqueueStatusRefresh } from "../enqueue";
import { requestStatusRefresh } from "../actions";

const op = (over: Record<string, unknown>) =>
  ({
    email: "op-a",
    permission: "member",
    allowedMenus: ["internal-admin"],
    ...over,
  }) as never;

describe("requestStatusRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SMS_SENDER_REQUEST_MANAGER_EMAIL", "mgr-x");
    vi.mocked(enqueueStatusRefresh).mockResolvedValue({
      ok: true,
      message: "요청함",
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("메뉴 권한이 없으면 거절, 적재 안 함", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(
      op({ email: "mgr-x", allowedMenus: ["services"] }),
    );
    const r = await requestStatusRefresh();
    expect(r.ok).toBe(false);
    expect(enqueueStatusRefresh).not.toHaveBeenCalled();
  });

  it("비로그인은 거절", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(null);
    const r = await requestStatusRefresh();
    expect(r.ok).toBe(false);
    expect(enqueueStatusRefresh).not.toHaveBeenCalled();
  });

  it("담당자도 admin 도 아니면 거절", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(op({}));
    expect(await requestStatusRefresh()).toEqual({
      ok: false,
      error:
        "현황 최신화는 관리자와 SMS 발신번호 등록 담당자만 할 수 있습니다.",
    });
    expect(enqueueStatusRefresh).not.toHaveBeenCalled();
  });

  it("담당자는 본인 메일로 적재", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(op({ email: "mgr-x" }));
    expect(await requestStatusRefresh()).toEqual({
      ok: true,
      message: "요청함",
    });
    expect(enqueueStatusRefresh).toHaveBeenCalledWith("mgr-x");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/internal-admin");
  });

  it("admin 은 적재", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(
      op({ permission: "admin", allowedMenus: [] }),
    );
    const r = await requestStatusRefresh();
    expect(r.ok).toBe(true);
    expect(enqueueStatusRefresh).toHaveBeenCalledWith("op-a");
  });

  it("적재 실패 메시지를 그대로 error 로", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(op({ email: "mgr-x" }));
    vi.mocked(enqueueStatusRefresh).mockResolvedValue({
      ok: false,
      message: "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.",
    });
    expect(await requestStatusRefresh()).toEqual({
      ok: false,
      error: "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.",
    });
  });
});
