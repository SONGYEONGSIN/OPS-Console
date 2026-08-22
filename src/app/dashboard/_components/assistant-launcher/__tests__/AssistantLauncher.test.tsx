import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AssistantLauncher } from "../AssistantLauncher";
import type { CurrentOperator } from "@/features/auth/queries";

// AssistantClient는 마운트 횟수만 관찰한다 — 패널을 닫을 때 언마운트되면
// 대화가 통째로 날아가므로, 그 회귀를 잡는 게 이 mock의 목적.
const { mountSpy } = vi.hoisted(() => ({ mountSpy: vi.fn() }));
vi.mock("../AssistantClient", async () => {
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

/** 런처 클릭 — 실제 브라우저처럼 mousedown을 먼저 흘린다.
 *  InspectorPanel이 document mousedown으로 외부 클릭을 판정하기 때문에,
 *  이 순서를 지켜야 "열린 상태에서 런처를 눌러도 안 닫히는" 회귀가 드러난다. */
function clickLauncher(el: HTMLElement) {
  fireEvent.mouseDown(el);
  fireEvent.click(el);
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

  it("런처를 누르면 인스펙터 패널이 열린다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    // 닫힘 = aria-hidden — 접근성 트리에서 빠진다
    expect(screen.queryByRole("complementary")).toBeNull();

    clickLauncher(screen.getByRole("button", { name: "어시스턴트" }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("열린 상태에서 런처를 다시 누르면 닫힌다", () => {
    // InspectorPanel은 document mousedown으로 외부 클릭을 판정한다. 런처는 패널
    // 밖이라 mousedown이 먼저 닫고 이어진 click 토글이 다시 열어버릴 수 있다.
    render(<AssistantLauncher me={operator("member")} />);
    const launcher = screen.getByRole("button", { name: "어시스턴트" });

    clickLauncher(launcher);
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    clickLauncher(launcher);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("ESC로 패널을 닫는다", () => {
    render(<AssistantLauncher me={operator("admin")} />);
    clickLauncher(screen.getByRole("button", { name: "어시스턴트" }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("패널을 닫아도 대화는 유지된다 — AssistantClient를 언마운트하지 않는다", () => {
    mountSpy.mockClear();
    render(<AssistantLauncher me={operator("member")} />);
    const launcher = screen.getByRole("button", { name: "어시스턴트" });

    clickLauncher(launcher); // 열기
    clickLauncher(launcher); // 닫기
    clickLauncher(launcher); // 다시 열기

    expect(mountSpy).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantLauncher — 닫기", () => {
  it("헤더에 닫기 버튼을 두지 않는다 — 화면을 비운다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    clickLauncher(screen.getByRole("button", { name: "어시스턴트" }));
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
  });

  it("ESC 로 패널이 닫힌다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    const launcher = screen.getByRole("button", { name: "어시스턴트" });
    clickLauncher(launcher);
    expect(launcher).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "어시스턴트" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("열려 있는 동안 런처는 감춘다 — 입력창 위에 떠서 글자를 덮는다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    const launcher = screen.getByRole("button", { name: "어시스턴트" });
    expect(launcher.className).not.toContain("opacity-0");

    clickLauncher(launcher);
    expect(
      screen.getByRole("button", { name: "어시스턴트" }).className,
    ).toContain("opacity-0");
  });

  it("닫으면 런처가 다시 보인다", () => {
    render(<AssistantLauncher me={operator("member")} />);
    clickLauncher(screen.getByRole("button", { name: "어시스턴트" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "어시스턴트" }).className,
    ).not.toContain("opacity-0");
  });
});
