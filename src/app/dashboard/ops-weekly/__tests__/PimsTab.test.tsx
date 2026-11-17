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
        freezeNotice={false}
      />,
    );
    inOrder(["PIMS", "금주 발표", "차주 발표", "영역 특이사항"]);
    expect(screen.getByText("자동 1건 · 직접 0건")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PIMS" }).className).toContain(
      "text-xl",
    );
  });

  it("안 붙음 줄 — 0건도 적고 조치는 n>0 일 때만", () => {
    const { rerender } = render(
      <PimsTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
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
        freezeNotice={false}
      />,
    );
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 2건 — 발표 서비스 담당자 맞추기를 다시 확인하세요",
      ),
    ).toBeInTheDocument();
  });
});

describe("PimsTab — 굳는 시점 안내", () => {
  it("안내를 담은 제목 묶음은 세로로 쌓여 좁은 폭에서 줄바꿈된다", () => {
    render(
      <PimsTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r1"
        editable={false}
        freezeNotice
      />,
    );
    const parent = screen.getByText(
      "자동 항목은 최종 보고 때 굳습니다",
    ).parentElement!;
    const cls = parent.className.split(/\s+/);
    expect(cls).toContain("flex-col");
    expect(cls).not.toContain("whitespace-nowrap");
    expect(cls).not.toContain("truncate");
    expect(cls.some((c) => /^(w|min-w)-\[/.test(c))).toBe(false);
  });
  it("제출 후 최종 보고 전이면 자동 묶음 위에 굳는 시점을 알린다", () => {
    render(
      <PimsTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r1"
        editable={false}
        freezeNotice
      />,
    );
    const note = screen.getByText("자동 항목은 최종 보고 때 굳습니다");
    const firstGroup = screen.getAllByRole("heading", { level: 3 })[0];
    expect(
      note.compareDocumentPosition(firstGroup) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it("freezeNotice 가 false 면 없다", () => {
    render(
      <PimsTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r1"
        editable={false}
        freezeNotice={false}
      />,
    );
    expect(screen.queryByText("자동 항목은 최종 보고 때 굳습니다")).toBeNull();
  });
});
