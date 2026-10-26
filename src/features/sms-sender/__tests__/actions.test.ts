import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../queries", () => ({ __resetSmsSenderCache: vi.fn() }));

import { getCurrentOperator } from "@/features/auth/queries";
import { revalidatePath } from "next/cache";
import { __resetSmsSenderCache } from "../queries";
import { refreshSmsSenderCache } from "../actions";

const op = (over: Record<string, unknown>) =>
  ({
    id: "o1",
    name: "[담당자]",
    permission: "member",
    allowedMenus: [],
    ...over,
  }) as never;
const REFUSAL = "권한 없음 — 내부관리자 메뉴를 볼 수 없습니다.";

describe("refreshSmsSenderCache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("지정 안 된 member 는 거절, 캐시 유지", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(
      op({ allowedMenus: ["services"] }),
    );
    expect(await refreshSmsSenderCache()).toEqual({
      ok: false,
      error: REFUSAL,
    });
    expect(__resetSmsSenderCache).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("비로그인은 거절", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(null);
    expect(await refreshSmsSenderCache()).toEqual({
      ok: false,
      error: REFUSAL,
    });
    expect(__resetSmsSenderCache).not.toHaveBeenCalled();
  });

  it("지정된 member 는 캐시를 비우고 경로를 다시 그린다", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(
      op({ allowedMenus: ["internal-admin"] }),
    );
    expect(await refreshSmsSenderCache()).toEqual({ ok: true });
    expect(__resetSmsSenderCache).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/internal-admin");
  });

  it("admin 은 통과", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(
      op({ permission: "admin" }),
    );
    expect(await refreshSmsSenderCache()).toEqual({ ok: true });
  });
});
