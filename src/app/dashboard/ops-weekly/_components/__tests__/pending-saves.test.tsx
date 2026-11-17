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

  it("진행 중인 저장이 없으면 바로 null", async () => {
    await expect(registry().settle()).resolves.toBeNull();
  });

  it("진행 중인 저장이 끝날 때까지 기다린다", async () => {
    const r = registry();
    const d = deferred();
    r.track(Symbol("a"), d.promise);
    let done = false;
    const waiting = r.settle().then((v) => {
      done = true;
      return v;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    d.resolve(null);
    await expect(waiting).resolves.toBeNull();
  });

  it("실패한 저장의 문구를 돌려주고, 같은 편집기가 다시 성공하면 지운다", async () => {
    const r = registry();
    const owner = Symbol("a");
    r.track(owner, Promise.resolve("저장 실패"));
    await expect(r.settle()).resolves.toBe("저장 실패");
    r.track(owner, Promise.resolve(null));
    await expect(r.settle()).resolves.toBeNull();
  });

  it("편집기가 사라지면(forget) 그 실패는 더는 막지 않는다", async () => {
    const r = registry();
    const owner = Symbol("a");
    r.track(owner, Promise.resolve("저장 실패"));
    await r.settle();
    r.forget(owner);
    await expect(r.settle()).resolves.toBeNull();
  });

  it("기다리는 동안 새로 등록된 저장도 기다린다", async () => {
    const r = registry();
    const first = deferred();
    const second = deferred();
    r.track(Symbol("a"), first.promise);
    const waiting = r.settle();
    r.track(Symbol("b"), second.promise);
    first.resolve(null);
    await new Promise((res) => setTimeout(res, 0));
    second.resolve("두 번째 실패");
    await expect(waiting).resolves.toBe("두 번째 실패");
  });
});
