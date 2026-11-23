import { useEffect } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  within,
} from "@testing-library/react";

const saveItemOverride = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: (...a: unknown[]) => saveItemOverride(...a),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
}));
vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { ApplicationTab } from "../_components/ApplicationTab";
import {
  PendingSavesProvider,
  usePendingSaves,
  type SaveRegistry,
} from "../_components/pending-saves";
import { setUrl } from "./search-params-mock";
import { EMPTY, item, snap } from "./tab-fixtures";

const held: { registry: SaveRegistry | null } = { registry: null };
function Probe() {
  const registry = usePendingSaves();
  useEffect(() => {
    held.registry = registry;
  }, [registry]);
  return null;
}

function mount() {
  const base = snap({ devStatusCollected: true });
  return render(
    <PendingSavesProvider>
      <Probe />
      <ApplicationTab
        snapshot={{
          ...base,
          application: { ...base.application, running: [item("closing:1")] },
        }}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />
    </PendingSavesProvider>,
  );
}

beforeEach(() => {
  held.registry = null;
  saveItemOverride.mockReset();
  setUrl("?week=2026-11-16&tab=application&sub=running");
});
afterEach(cleanup);

describe("숨은 패널의 저장 — 하위 탭을 옮겨도 제출이 기다리고 막는다", () => {
  it("메모를 고치다 다른 하위 탭으로 옮겨도 등록된 저장이 settle 을 붙잡고, 실패하면 막는다", async () => {
    let finish: (v: { ok: false; error: string }) => void = () => {};
    saveItemOverride.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    mount();
    const panel = screen.getByRole("tabpanel", { name: /운영 중/ });
    fireEvent.click(within(panel).getByRole("button", { name: "메모" }));
    const input = within(panel).getByLabelText("건 메모");
    fireEvent.change(input, { target: { value: "임시 메모" } });
    fireEvent.blur(input);
    expect(saveItemOverride).toHaveBeenCalledTimes(1);

    // 다른 하위 탭으로 — 메모가 있는 패널은 hidden 이지만 마운트된 채다
    fireEvent.click(screen.getByRole("tab", { name: /개발 중/ }));
    expect(panel).toHaveAttribute("hidden");
    expect(held.registry?.hasPending()).toBe(true);

    let outcome: string | null = null;
    const settled = held.registry!.settle(5000).then((r) => {
      outcome = r.status;
      return r;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(outcome).toBeNull(); // 저장이 끝나기 전에는 기다린다

    await act(async () => {
      finish({ ok: false, error: "서버 거절" });
      await settled;
    });
    expect(outcome).toBe("failed");
    const r = await settled;
    expect(r.status === "failed" && r.message).toContain("서버 거절");
  });

  it("성공하면 ok", async () => {
    saveItemOverride.mockResolvedValue({ ok: true });
    mount();
    const panel = screen.getByRole("tabpanel", { name: /운영 중/ });
    fireEvent.click(within(panel).getByRole("button", { name: "메모" }));
    const input = within(panel).getByLabelText("건 메모");
    fireEvent.change(input, { target: { value: "메모" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("tab", { name: /테스트 중/ }));
    let status = "";
    await act(async () => {
      status = (await held.registry!.settle(5000)).status;
    });
    expect(status).toBe("ok");
  });
});
