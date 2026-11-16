import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: vi.fn(),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));

import { PimsTab } from "../_components/PimsTab";
import { inOrder } from "./heading-order";
import { EMPTY, snap } from "./tab-fixtures";

afterEach(cleanup);

describe("PimsTab", () => {
  it("PIMS 금주/차주 두 묶음", () => {
    render(
      <PimsTab
        snapshot={snap({ pimsThis: ["pims:1"], pimsNext: [] })}
        detail={EMPTY}
        reportId="r"
        editable
      />,
    );
    inOrder(["금주 발표", "차주 발표"]);
  });

  it("안 붙음 줄 — 0건도 적고 조치는 n>0 일 때만", () => {
    const { rerender } = render(
      <PimsTab snapshot={snap()} detail={EMPTY} reportId="r" editable />,
    );
    expect(
      screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 0건"),
    ).toBeInTheDocument();
    rerender(
      <PimsTab
        snapshot={snap({ unmatchedPims: 2 })}
        detail={EMPTY}
        reportId="r"
        editable
      />,
    );
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 2건 — 발표 서비스 담당자 맞추기를 다시 확인하세요",
      ),
    ).toBeInTheDocument();
  });
});
