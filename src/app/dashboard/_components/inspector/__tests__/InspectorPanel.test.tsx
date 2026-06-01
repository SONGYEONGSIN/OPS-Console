import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorPanel } from "../InspectorPanel";

describe("InspectorPanel", () => {
  it("open=true — 패널 visible (translate-x-0)", () => {
    render(
      <InspectorPanel open={true} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("translate-x-0");
  });

  it("open=false — 패널 hidden (translate-x-full + aria-hidden)", () => {
    render(
      <InspectorPanel open={false} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    // open=false면 aria-hidden=true이므로 hidden:true 옵션 필요
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel.className).toContain("translate-x-full");
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("ESC 키 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("외부 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button>외부</button>
        <InspectorPanel open={true} onClose={onClose}>
          <p>내용</p>
        </InspectorPanel>
      </div>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "외부" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("#ops-modal-root(모달 오버레이) 내부 클릭은 외부 클릭으로 보지 않음 — onClose 미호출", () => {
    const onClose = vi.fn();
    // 앱에서는 DashboardShell이 렌더하는 모달 portal 마운트 지점.
    const modalRoot = document.createElement("div");
    modalRoot.id = "ops-modal-root";
    const modalChild = document.createElement("button");
    modalChild.textContent = "모달 내부 버튼";
    modalRoot.appendChild(modalChild);
    document.body.appendChild(modalRoot);

    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.mouseDown(modalChild);
    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(modalRoot);
  });
});
