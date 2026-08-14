import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AssistantLauncher } from "../AssistantLauncher";
import type { CurrentOperator } from "@/features/auth/queries";

// AssistantClient는 마운트 횟수만 관찰한다 — 패널을 닫을 때 언마운트되면
// 대화가 통째로 날아가므로, 그 회귀를 잡는 게 이 mock의 목적.
const { mountSpy } = vi.hoisted(() => ({ mountSpy: vi.fn() }));
vi.mock("../../../ai-assistant/AssistantClient", async () => {
  const { useEffect } = await import("react");
  return {
    AssistantClient: () => {
      useEffect(() => {
        mountSpy();
      }, []);
      return <div>ASSISTANT_CLIENT</div>;
    },
  };
});

function operator(permission: CurrentOperator["permission"]): CurrentOperator {
  return {
    email: "me@x.com",
    operator: null,
    displayName: "송영신",
    role: "팀장",
    team: null,
    permission,
    allowedMenus: [],
  };
}

describe("AssistantLauncher", () => {
  it("운영자에게 우하단 런처 버튼을 보여준다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    expect(screen.getByRole("button", { name: "어시스턴트" })).toBeInTheDocument();
  });

  it("viewer에게는 런처를 보여주지 않는다", () => {
    // /api/assistant/ask가 viewer를 403으로 막는다 — 눌러도 실패할 버튼은 안 그린다.
    render(<AssistantLauncher me={operator("viewer")} />);
    expect(screen.queryByRole("button", { name: "어시스턴트" })).toBeNull();
  });

  it("비로그인 상태에서는 런처를 보여주지 않는다", () => {
    render(<AssistantLauncher me={null} />);
    expect(screen.queryByRole("button", { name: "어시스턴트" })).toBeNull();
  });

  it("런처를 누르면 채팅 패널이 열린다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    const panel = screen.getByRole("dialog", { hidden: true });
    expect(panel).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "어시스턴트" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("ESC로 패널을 닫는다", () => {
    render(<AssistantLauncher me={operator("admin")} />);
    fireEvent.click(screen.getByRole("button", { name: "어시스턴트" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.getByRole("dialog", { hidden: true })).not.toBeVisible();
  });

  it("패널을 닫아도 대화는 유지된다 — AssistantClient를 언마운트하지 않는다", () => {
    mountSpy.mockClear();
    render(<AssistantLauncher me={operator("member")} />);
    const launcher = screen.getByRole("button", { name: "어시스턴트" });

    fireEvent.click(launcher); // 열기
    fireEvent.click(launcher); // 닫기
    fireEvent.click(launcher); // 다시 열기

    expect(mountSpy).toHaveBeenCalledTimes(1);
  });
});
