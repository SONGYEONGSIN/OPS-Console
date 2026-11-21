import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OnOffToggle } from "../_components/OnOffToggle";

afterEach(cleanup);

describe("OnOffToggle — 자동화 메뉴와 같은 ON | OFF", () => {
  it("켜져 있으면 ON 이 눌린 채 잠기고, OFF 를 누르면 false 를 알린다", () => {
    const onChange = vi.fn();
    render(<OnOffToggle label="운영자A 받는 사람" on onChange={onChange} />);
    expect(
      screen.getByRole("group", { name: "운영자A 받는 사람" }),
    ).toBeInTheDocument();
    const on = screen.getByRole("button", { name: "ON" });
    const off = screen.getByRole("button", { name: "OFF" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on).toBeDisabled();
    expect(on.className).toContain("bg-ink");
    expect(off).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(off);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("꺼져 있으면 ON 을 눌러 true", () => {
    const onChange = vi.fn();
    render(<OnOffToggle label="x" on={false} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "OFF" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "ON" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled 면 둘 다 잠긴다 — 상태는 그대로 보인다", () => {
    render(<OnOffToggle label="x" on disabled onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "ON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "OFF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ON" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("lockOff 면 켜진 상태에서 끌 수 없다(당번은 비울 수 없다)", () => {
    render(<OnOffToggle label="x" on lockOff onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "OFF" })).toBeDisabled();
  });
});
