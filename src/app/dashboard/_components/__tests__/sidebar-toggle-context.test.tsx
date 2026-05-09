import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SidebarToggleProvider,
  useSidebarToggle,
} from "../sidebar-toggle-context";

function Trigger() {
  const { open } = useSidebarToggle();
  return (
    <button type="button" onClick={open}>
      open-trigger
    </button>
  );
}

describe("SidebarToggleProvider / useSidebarToggle", () => {
  it("Provider가 주입한 open 콜백이 hook 호출 시 실행", () => {
    const openSpy = vi.fn();
    render(
      <SidebarToggleProvider open={openSpy}>
        <Trigger />
      </SidebarToggleProvider>,
    );
    fireEvent.click(screen.getByText("open-trigger"));
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("Provider 밖에서 hook 호출 시 throw", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(
      /SidebarToggleProvider 안에서만 사용/,
    );
    errSpy.mockRestore();
  });
});
