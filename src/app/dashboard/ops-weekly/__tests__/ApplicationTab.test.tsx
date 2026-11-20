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

import { ApplicationTab } from "../_components/ApplicationTab";
import { computeKpis, type ManualItem } from "@/features/ops-weekly/merge";
import { setUrl } from "./search-params-mock";
import { EMPTY, item, snap } from "./tab-fixtures";

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
  area: "application",
  group_key: group,
  title: `직접 ${group}`,
  note: "",
  period_start: null,
  period_end: null,
  leave_kind: null,
});

const tabNames = () =>
  screen.getAllByRole("tab").map((t) => t.firstChild?.textContent);
const tabCount = (label: string) =>
  within(screen.getByRole("tab", { name: new RegExp(label) })).getByText(
    /^(\d+|—)$/,
  ).textContent;

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("ApplicationTab — 하위 탭", () => {
  it("탭 순서는 KPI 순서(개발·테스트·운영·오픈·마감) + 원서접수 외", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true })}
      />,
    );
    expect(
      screen.getByRole("tablist", { name: "원서접수 묶음" }),
    ).toBeInTheDocument();
    expect(tabNames()).toEqual([
      "개발 중",
      "테스트 중",
      "운영 중",
      "차주 오픈 예정",
      "차주 마감 예정",
      "원서접수 외 서비스",
    ]);
  });

  it("구분 미확인 탭은 수집됐고 건이 있을 때만, 테스트 중 바로 뒤", () => {
    const { rerender } = render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true, unknown: 2 })}
      />,
    );
    expect(tabNames().slice(0, 4)).toEqual([
      "개발 중",
      "테스트 중",
      "구분 미확인",
      "운영 중",
    ]);
    expect(tabCount("구분 미확인")).toBe("2");
    rerender(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true, unknown: 0 })}
      />,
    );
    expect(tabNames()).not.toContain("구분 미확인");
    rerender(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: false, unknown: 3 })}
      />,
    );
    expect(tabNames()).not.toContain("구분 미확인");
  });

  it("구분 미확인 묶음은 접히지 않고 직접 추가가 없다", () => {
    setUrl("?sub=unknown");
    const { container } = render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true, unknown: 2 })}
      />,
    );
    const panel = screen.getByRole("tabpanel", { name: /구분 미확인/ });
    expect(container.querySelector("details")).toBeNull();
    expect(
      within(panel).getByRole("heading", { name: "구분 미확인" }),
    ).toBeInTheDocument();
    expect(within(panel).getByText("2건")).toBeInTheDocument();
    expect(
      within(panel).queryByRole("button", { name: "+ 직접 추가" }),
    ).toBeNull();
  });

  it("지금 안 보이는 구분 미확인을 sub 로 부르면 기본 탭(개발 중)", () => {
    setUrl("?sub=unknown");
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true, unknown: 0 })}
      />,
    );
    expect(screen.getByRole("tab", { name: /개발 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("탭 숫자 = KPI 식(뺀 건 제외 + 직접), 같은 패널의 머리 숫자와 같다", () => {
    const base = snap({ devStatusCollected: true });
    const snapshot = {
      ...base,
      application: {
        ...base.application,
        running: [item("a"), item("b"), item("c")],
        dev: [item("d1")],
      },
    };
    const detail = {
      ...EMPTY,
      overrides: new Map([["b", { item_key: "b", note: "", excluded: true }]]),
      manual: [manual("running"), manual("dev", "m2")],
    };
    setUrl("?sub=running");
    render(<ApplicationTab {...PROPS} snapshot={snapshot} detail={detail} />);
    const k = computeKpis(snapshot, detail.overrides, detail.manual);
    expect(k.running).toBe(3);
    expect(tabCount("운영 중")).toBe(String(k.running));
    expect(tabCount("개발 중")).toBe(String(k.dev));
    const panel = screen.getByRole("tabpanel", { name: /운영 중/ });
    expect(within(panel).getByText(`${k.running}건`)).toBeInTheDocument();
    // 뺀 행은 목록에 그대로 남는다
    expect(within(panel).getAllByRole("listitem")).toHaveLength(4);
  });

  it("원서접수 외 서비스 숫자는 직접 추가 건만", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true })}
        detail={{
          ...EMPTY,
          manual: [manual("other"), manual("other", "m2"), manual("dev", "m3")],
        }}
      />,
    );
    expect(tabCount("원서접수 외 서비스")).toBe("2");
  });

  it("비활성 패널은 DOM 에 남고 hidden 이다 — 활성 패널만 접근 가능", () => {
    const { container } = render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true })}
      />,
    );
    const panels = [...container.querySelectorAll('[role="tabpanel"]')];
    expect(panels).toHaveLength(6);
    expect(panels.filter((p) => !p.hasAttribute("hidden"))).toHaveLength(1);
    expect(panels[0]).not.toHaveAttribute("hidden");
    expect(
      screen.getByRole("heading", { name: "개발 중" }),
    ).toBeInTheDocument();
    // 비활성 묶음 제목은 DOM 에는 있되 접근 트리에는 없다
    expect(screen.queryByRole("heading", { name: "운영 중" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "운영 중", hidden: true }),
    ).toBeInTheDocument();
  });

  it("영역 특이사항은 패널 밖에서 늘 보인다", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true })}
      />,
    );
    const h = screen.getByRole("heading", { name: "영역 특이사항" });
    expect(h.closest("[role=tabpanel]")).toBeNull();
    expect(h.closest("[hidden]")).toBeNull();
  });
});

describe("ApplicationTab", () => {
  it("수집 전이면 개발/테스트 묶음 대신 구분 미확인 문구", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: false, unknown: 3 })}
      />,
    );
    expect(
      screen.getAllByText(
        "개발/테스트 구분이 아직 수집되지 않았습니다 (시작 전 서비스 3건)",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "개발 중", hidden: true }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "테스트 중", hidden: true }),
    ).toBeNull();
    // 집계할 수 없는 값은 0 이 아니라 —
    expect(tabCount("개발 중")).toBe("—");
    expect(tabCount("테스트 중")).toBe("—");
  });

  it("묶음 순서(운영 → 오픈 → 마감)", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true })}
      />,
    );
    const hs = ["개발 중", "테스트 중", "운영 중", "차주 오픈 예정"].map((n) =>
      screen.getByRole("heading", { name: n, hidden: true }),
    );
    hs.slice(1).forEach((h, i) =>
      expect(
        hs[i].compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy(),
    );
  });

  it("탭 제목은 h2 크기이고 건수는 제목 밖에 자동·직접으로 나눠 적는다", () => {
    const base = snap({ devStatusCollected: true });
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={{
          ...base,
          application: {
            ...base.application,
            running: [item("a"), item("b")],
          },
        }}
        detail={{ ...EMPTY, manual: [manual("running")] }}
      />,
    );
    const h = screen.getByRole("heading", { name: "원서접수" });
    expect(h.className).toContain("text-xl");
    expect(h.className).toContain("font-bold");
    const count = screen.getByText("자동 2건 · 직접 1건");
    expect(count.className).toContain("tabular-nums");
    expect(h.contains(count)).toBe(false);
  });

  it("탭 안 큰 절 사이 간격(gap-7), 하위 탭 줄과 패널 간격(gap-6)", () => {
    const { container } = render(
      <ApplicationTab {...PROPS} snapshot={snap()} />,
    );
    const root = container.firstElementChild as Element;
    expect(root.className).toContain("gap-7");
    expect(
      (screen.getByRole("tablist").parentElement?.parentElement as Element)
        .className,
    ).toContain("gap-6");
  });

  it("구분이 수집되지 않은 주에 직접 추가한 개발 건도 보이고 센다", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: false })}
        detail={{ ...EMPTY, manual: [manual("dev")] }}
      />,
    );
    expect(screen.getByText("직접 dev")).toBeInTheDocument();
    expect(screen.getByText("자동 0건 · 직접 1건")).toBeInTheDocument();
    expect(tabCount("개발 중")).toBe("1");
    expect(tabCount("테스트 중")).toBe("—");
  });

  it("수집된 주에 시작 전 서비스가 0건이면 미수집 문구 없이 직접 추가 건이 보인다", () => {
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: true, unknown: 0 })}
        detail={{ ...EMPTY, manual: [manual("dev")] }}
      />,
    );
    expect(screen.queryByText(/아직 수집되지 않았습니다/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "개발 중" }),
    ).toBeInTheDocument();
    expect(screen.getByText("직접 dev")).toBeInTheDocument();
    expect(screen.getByText("자동 0건 · 직접 1건")).toBeInTheDocument();
  });
});

describe("ApplicationTab — 안 붙은 서비스 안내는 관리자에게만", () => {
  it("비관리자에게는 문구도 링크도 없다(0건이어도 4건이어도)", () => {
    for (const n of [0, 4]) {
      const { unmount } = render(
        <ApplicationTab
          {...PROPS}
          isAdmin={false}
          snapshot={snap({ unmatchedApplication: n })}
        />,
      );
      expect(screen.queryByText(/안 붙은 서비스/)).toBeNull();
      expect(screen.queryByText("관리에서 목록 보기")).toBeNull();
      unmount();
    }
  });

  it("관리자: 0 건도 적고 링크는 없다", () => {
    render(
      <ApplicationTab
        {...PROPS}
        isAdmin
        snapshot={snap({ unmatchedApplication: 0 })}
      />,
    );
    expect(
      screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 서비스 0건"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "관리에서 목록 보기" }),
    ).toBeNull();
  });

  it("관리자: 있으면 한 문장으로 조치까지 + 설정 패널로 가는 링크", () => {
    render(
      <ApplicationTab
        {...PROPS}
        isAdmin
        snapshot={snap({ unmatchedApplication: 4 })}
      />,
    );
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 서비스 4건 — 서비스마감 메뉴에서 담당자 이름을 확인하세요",
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "관리에서 목록 보기" });
    expect(link).toHaveAttribute("href", SETTINGS);
    expect(link.className).toContain("text-xs");
    expect(link.className).toContain("underline");
  });
});

describe("ApplicationTab — 굳는 시점 안내", () => {
  it("제출 후 최종 보고 전이면 자동 묶음 위에 굳는 시점을 알린다", () => {
    render(
      <ApplicationTab
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
      <ApplicationTab
        {...PROPS}
        snapshot={snap()}
        reportId="r1"
        editable={false}
      />,
    );
    expect(screen.queryByText("자동 항목은 최종 보고 때 굳습니다")).toBeNull();
  });
});

describe("ApplicationTab — 숫자 규칙·기본 탭(리뷰 반영)", () => {
  it("탭 머리 요약 '자동 N건'도 뺀 건을 세지 않는다", () => {
    const base = snap({ devStatusCollected: true });
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={{
          ...base,
          application: {
            ...base.application,
            running: [item("a"), item("b"), item("c")],
          },
        }}
        detail={{
          ...EMPTY,
          overrides: new Map([
            ["b", { item_key: "b", note: "", excluded: true }],
          ]),
        }}
      />,
    );
    expect(screen.getByText("자동 2건 · 직접 0건")).toBeInTheDocument();
    expect(tabCount("운영 중")).toBe("2");
  });

  it("미수집 문구의 '시작 전 서비스 N건'도 뺀 건을 뺀다", () => {
    const base = snap({ devStatusCollected: false });
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={{
          ...base,
          application: {
            ...base.application,
            unknown: [item("u1"), item("u2"), item("u3")],
          },
        }}
        detail={{
          ...EMPTY,
          overrides: new Map([
            ["u2", { item_key: "u2", note: "", excluded: true }],
          ]),
        }}
      />,
    );
    expect(
      screen.getAllByText(
        "개발/테스트 구분이 아직 수집되지 않았습니다 (시작 전 서비스 2건)",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("구분 미수집 주의 기본 탭은 운영 중, 수집된 주는 개발 중(sub 없음)", () => {
    const { unmount } = render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: false })}
      />,
    );
    expect(screen.getByRole("tab", { name: /운영 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();
    render(
      <ApplicationTab {...PROPS} snapshot={snap({ devStatusCollected: true })} />,
    );
    expect(screen.getByRole("tab", { name: /개발 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("URL 의 sub 는 기본값보다 우선한다(수집 전 주에도)", () => {
    setUrl("?sub=dev");
    render(
      <ApplicationTab
        {...PROPS}
        snapshot={snap({ devStatusCollected: false })}
      />,
    );
    expect(screen.getByRole("tab", { name: /개발 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
