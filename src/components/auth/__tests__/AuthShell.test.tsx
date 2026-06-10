import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { AuthShell } from "../AuthShell";

describe("AuthShell", () => {
  it("main 배경을 bg-paper 토큰으로 렌더 (login 페이지와 동일 #fbf7f0)", () => {
    const { container } = render(
      <AuthShell>
        <div>child</div>
      </AuthShell>,
    );
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.className).toContain("bg-paper");
  });
});
