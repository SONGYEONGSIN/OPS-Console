import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useRef } from "react";
import { useHeightVar } from "../_components/use-height-var";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  useHeightVar(ref, "--x-h");
  return (
    <section data-testid="host">
      <div ref={ref} />
    </section>
  );
}

describe("useHeightVar — 고정 막대 높이를 부모의 CSS 변수로", () => {
  it("요소 높이를 올림해 부모에 쓰고, 0 이면(숨김) 지운다", () => {
    let cb: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(fn: () => void) {
          cb = fn;
        }
        observe() {}
        disconnect() {}
      },
    );
    let h = 31.2;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ height: h }) as DOMRect,
    );
    const { getByTestId } = render(<Probe />);
    const host = getByTestId("host");
    expect(host.style.getPropertyValue("--x-h")).toBe("32px");
    h = 0;
    cb();
    expect(host.style.getPropertyValue("--x-h")).toBe("");
  });
});
