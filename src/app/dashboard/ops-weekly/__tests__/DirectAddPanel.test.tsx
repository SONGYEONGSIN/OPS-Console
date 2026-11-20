import { useEffect } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";

vi.mock("next/navigation", async () =>
  (await import("./search-params-mock")).navigationModule,
);
const addManualItem = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  addManualItem: (...a: unknown[]) => addManualItem(...a),
}));

import { DirectAddPanel } from "../_components/DirectAddPanel";
import {
  PendingSavesProvider,
  usePendingSaves,
  type SaveRegistry,
} from "../_components/pending-saves";
import { directAddGroups } from "../_groups";
import { setUrl } from "./search-params-mock";

const groups = directAddGroups("application", true);
const st = { showUnknown: true, collected: true };

const held: { registry: SaveRegistry | null } = { registry: null };
function Probe() {
  const registry = usePendingSaves();
  useEffect(() => {
    held.registry = registry;
  }, [registry]);
  return null;
}

beforeEach(() => {
  held.registry = null;
  addManualItem.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("DirectAddPanel", () => {
  it("묶음 기본값은 왼쪽에서 보는 하위 칸이고, 하위 칸이 바뀌면 따라간다", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    expect(screen.getByLabelText("묶음")).toHaveValue("running");
    act(() => setUrl("?week=2026-11-16&tab=application&sub=closing"));
    expect(screen.getByLabelText("묶음")).toHaveValue("closing");
  });

  it("머리는 h3 직접 추가", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "직접 추가" }),
    ).toBeInTheDocument();
  });

  it("하위 칸이 직접 추가가 없는 묶음(구분 미확인)이면 첫 묶음", () => {
    setUrl("?week=2026-11-16&tab=application&sub=unknown");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    expect(screen.getByLabelText("묶음")).toHaveValue("dev");
  });

  it("RF2 묶음을 바꾸고 하위 칸이 바뀌어도 쓰던 제목이 남고, [추가]는 고른 묶음으로", async () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    fireEvent.change(screen.getByLabelText("직접 추가 제목"), {
      target: { value: "새 서비스" },
    });
    fireEvent.change(screen.getByLabelText("묶음"), {
      target: { value: "other" },
    });
    act(() => setUrl("?week=2026-11-16&tab=application&sub=dev"));
    expect(screen.getByLabelText("직접 추가 제목")).toHaveValue("새 서비스");
    fireEvent.change(screen.getByLabelText("묶음"), {
      target: { value: "opening" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(addManualItem).toHaveBeenCalledWith(
        expect.objectContaining({
          area: "application",
          groupKey: "opening",
          title: "새 서비스",
        }),
      ),
    );
  });

  it("사람이 고른 묶음은 하위 칸이 바뀌기 전까지 남는다", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    fireEvent.change(screen.getByLabelText("묶음"), {
      target: { value: "other" },
    });
    expect(screen.getByLabelText("묶음")).toHaveValue("other");
    act(() => setUrl("?week=2026-11-16&tab=application&sub=running&x=1"));
    expect(screen.getByLabelText("묶음")).toHaveValue("other");
  });

  it("합격자 발표 — 하위 칸을 따라간다", () => {
    setUrl("?week=2026-11-16&tab=pims&sub=nextWeek");
    render(
      <DirectAddPanel
        area="pims"
        reportId="r"
        groups={directAddGroups("pims", true)}
        appSubState={st}
      />,
    );
    expect(screen.getByLabelText("묶음")).toHaveValue("nextWeek");
  });

  it("휴가·외근 — 묶음 선택 없이 기간·구분 칸, groupKey null", () => {
    setUrl("?week=2026-11-16&tab=leave");
    render(
      <DirectAddPanel
        area="leave"
        reportId="r"
        groups={directAddGroups("leave", true)}
        appSubState={st}
      />,
    );
    expect(screen.queryByLabelText("묶음")).toBeNull();
    expect(screen.getByLabelText("시작일")).toBeInTheDocument();
  });

  it("[닫기] 가 없다 — 패널에 늘 열려 있다", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
    expect(screen.getByLabelText("직접 추가 제목")).not.toHaveFocus();
  });

  it("[추가] 가 실패해도 제출을 막지 않는다 — 저장 대기에 등록하지 않는다", async () => {
    addManualItem.mockResolvedValue({ ok: false, error: "제목을 입력하세요" });
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <PendingSavesProvider>
        <Probe />
        <DirectAddPanel
          area="application"
          reportId="r"
          groups={groups}
          appSubState={st}
        />
      </PendingSavesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("제목을 입력하세요")).toBeInTheDocument();
    expect(held.registry?.hasPending()).toBe(false);
    let status = "";
    await act(async () => {
      status = (await held.registry!.settle(5000)).status;
    });
    expect(status).toBe("ok");
  });

  it("묶음 선택과 [추가] 는 입력창 표준 클래스를 쓴다", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(
      <DirectAddPanel
        area="application"
        reportId="r"
        groups={groups}
        appSubState={st}
      />,
    );
    const select = screen.getByLabelText("묶음").className.split(/\s+/);
    expect(select).toContain("border-line-soft");
    expect(select).toContain("bg-field-bg");
    const btn = screen.getByRole("button", { name: "추가" }).className.split(/\s+/);
    expect(btn).toContain("hover:bg-ink");
    expect(btn).toContain("hover:text-cream");
  });
});
