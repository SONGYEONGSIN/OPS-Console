import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: vi.fn(),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));
vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { PimsTab } from "../_components/PimsTab";
import type { ManualItem } from "@/features/ops-weekly/merge";
import { setUrl } from "./search-params-mock";
import { EMPTY, snap } from "./tab-fixtures";

const SETTINGS = "/dashboard/ops-weekly?week=2026-11-16&tab=settings#unmatched";
const PROPS = {
  detail: EMPTY,
  reportId: "r",
  editable: true,
  freezeNotice: false,
  isAdmin: false,
  settingsHref: SETTINGS,
};

const manual = (group: string, id = "m1"): ManualItem => ({
  id,
  area: "pims",
  group_key: group,
  title: `직접 ${group}`,
  note: "",
  period_start: null,
  period_end: null,
  leave_kind: null,
});

const tabCount = (label: string) =>
  within(screen.getByRole("tab", { name: new RegExp(label) })).getByText(
    /^\d+$/,
  ).textContent;

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=pims");
});
afterEach(cleanup);

describe("PimsTab", () => {
  it("금주 발표 / 차주 발표 두 하위 탭, 숫자는 뺀 건 제외 + 직접", () => {
    render(
      <PimsTab
        {...PROPS}
        snapshot={snap({
          pimsThis: ["pims:1", "pims:2"],
          pimsNext: ["pims:3"],
        })}
        detail={{
          ...EMPTY,
          overrides: new Map([
            ["pims:2", { item_key: "pims:2", note: "", excluded: true }],
          ]),
          manual: [manual("nextWeek")],
        }}
      />,
    );
    expect(
      screen.getByRole("tablist", { name: "PIMS 묶음" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab").map((t) => t.firstChild?.textContent),
    ).toEqual(["금주 발표", "차주 발표"]);
    expect(tabCount("금주 발표")).toBe("1");
    expect(tabCount("차주 발표")).toBe("2");
    expect(screen.getByText("자동 2건 · 직접 1건")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PIMS" }).className).toContain(
      "text-xl",
    );
  });

  it("차주 발표 패널도 DOM 에 있고 hidden, sub=nextWeek 로 열린다", () => {
    const { container, unmount } = render(
      <PimsTab {...PROPS} snapshot={snap({ pimsThis: ["pims:1"] })} />,
    );
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    expect(panels[0]).not.toHaveAttribute("hidden");
    expect(panels[1]).toHaveAttribute("hidden");
    expect(
      screen.getByRole("heading", { name: "금주 발표" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차주 발표" })).toBeNull();
    unmount();
    setUrl("?sub=nextWeek");
    render(<PimsTab {...PROPS} snapshot={snap()} />);
    expect(screen.getByRole("tab", { name: /차주 발표/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "차주 발표" }),
    ).toBeInTheDocument();
  });

  it("원서접수 탭의 sub 값은 PIMS 에서 무시한다", () => {
    setUrl("?sub=running");
    render(<PimsTab {...PROPS} snapshot={snap()} />);
    expect(screen.getByRole("tab", { name: /금주 발표/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("영역 특이사항은 패널 밖에서 늘 보인다", () => {
    render(<PimsTab {...PROPS} snapshot={snap()} />);
    expect(
      screen
        .getByRole("heading", { name: "영역 특이사항" })
        .closest("[role=tabpanel]"),
    ).toBeNull();
  });

  it("안 붙음 줄 — 비관리자에게는 없다", () => {
    render(<PimsTab {...PROPS} snapshot={snap({ unmatchedPims: 2 })} />);
    expect(screen.queryByText(/안 붙은/)).toBeNull();
    expect(screen.queryByText("설정에서 목록 보기")).toBeNull();
  });

  it("안 붙음 줄 — 관리자는 0건도 적고 조치·링크는 n>0 일 때만", () => {
    const { rerender } = render(
      <PimsTab {...PROPS} isAdmin snapshot={snap()} />,
    );
    expect(
      screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 0건"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "설정에서 목록 보기" }),
    ).toBeNull();
    rerender(
      <PimsTab {...PROPS} isAdmin snapshot={snap({ unmatchedPims: 2 })} />,
    );
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 2건 — 발표 서비스 담당자 맞추기를 다시 확인하세요",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "설정에서 목록 보기" }),
    ).toHaveAttribute("href", SETTINGS);
  });
});

describe("PimsTab — 굳는 시점 안내", () => {
  it("안내를 담은 제목 묶음은 세로로 쌓여 좁은 폭에서 줄바꿈된다", () => {
    render(
      <PimsTab
        {...PROPS}
        snapshot={snap()}
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
        {...PROPS}
        snapshot={snap()}
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
      <PimsTab {...PROPS} snapshot={snap()} reportId="r1" editable={false} />,
    );
    expect(screen.queryByText("자동 항목은 최종 보고 때 굳습니다")).toBeNull();
  });
});

describe("PimsTab — 요약도 뺀 건을 세지 않는다", () => {
  it("자동 N건", () => {
    render(
      <PimsTab
        {...PROPS}
        snapshot={snap({ pimsThis: ["pims:1", "pims:2"], pimsNext: ["pims:3"] })}
        detail={{
          ...EMPTY,
          overrides: new Map([
            ["pims:2", { item_key: "pims:2", note: "", excluded: true }],
          ]),
        }}
      />,
    );
    expect(screen.getByText("자동 2건 · 직접 0건")).toBeInTheDocument();
  });
});
