import { describe, it, expect, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { PendingSavesProvider, usePendingSaves } from "../pending-saves";

afterEach(cleanup);

function registry() {
  const { result } = renderHook(() => usePendingSaves(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <PendingSavesProvider>{children}</PendingSavesProvider>
    ),
  });
  if (result.current === null) throw new Error("provider");
  return result.current;
}

function deferred() {
  let resolve!: (v: string | null) => void;
  const promise = new Promise<string | null>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("pending-saves 등록부", () => {
  it("제공자 밖에서는 null", () => {
    const { result } = renderHook(() => usePendingSaves());
    expect(result.current).toBeNull();
  });

  it("진행 중인 저장이 없으면 바로 ok", async () => {
    await expect(registry().settle()).resolves.toEqual({ status: "ok" });
  });

  it("진행 중인 저장이 끝날 때까지 기다린다", async () => {
    const r = registry();
    const d = deferred();
    r.track("a", "A", d.promise);
    expect(r.hasPending()).toBe(true);
    let done = false;
    const waiting = r.settle().then((v) => {
      done = true;
      return v;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    d.resolve(null);
    await expect(waiting).resolves.toEqual({ status: "ok" });
    expect(r.hasPending()).toBe(false);
  });

  it("실패는 어느 저장인지(라벨)와 함께 돌려준다", async () => {
    const r = registry();
    r.track("note:r:pims", "PIMS 영역 특이사항", Promise.resolve("저장 실패"));
    await expect(r.settle()).resolves.toEqual({
      status: "failed",
      message: "PIMS 영역 특이사항: 저장 실패",
    });
  });

  it("실패는 같은 키의 나중 저장이 성공해야만 지워진다", async () => {
    const r = registry();
    r.track("k", "A", Promise.resolve("실패"));
    r.track("other", "B", Promise.resolve(null));
    await expect(r.settle()).resolves.toMatchObject({ status: "failed" });
    r.track("k", "A", Promise.resolve(null));
    await expect(r.settle()).resolves.toEqual({ status: "ok" });
  });

  it("같은 키에서 먼저 시작한 저장이 늦게 끝나도 나중 결과를 덮지 않는다", async () => {
    const r = registry();
    const first = deferred();
    r.track("k", "A", first.promise);
    r.track("k", "A", Promise.resolve(null));
    first.resolve("낡은 실패");
    await expect(r.settle()).resolves.toEqual({ status: "ok" });
  });

  it("기다리는 동안 새로 등록된 저장도 기다린다", async () => {
    const r = registry();
    const first = deferred();
    const second = deferred();
    r.track("a", "A", first.promise);
    const waiting = r.settle();
    r.track("b", "B", second.promise);
    first.resolve(null);
    await new Promise((res) => setTimeout(res, 0));
    second.resolve("두 번째 실패");
    await expect(waiting).resolves.toEqual({
      status: "failed",
      message: "B: 두 번째 실패",
    });
  });

  it("끝나지 않는 저장은 제한 시간 뒤 timeout", async () => {
    const r = registry();
    r.track("a", "A", new Promise(() => undefined));
    await expect(r.settle(20)).resolves.toEqual({ status: "timeout" });
  });
});
