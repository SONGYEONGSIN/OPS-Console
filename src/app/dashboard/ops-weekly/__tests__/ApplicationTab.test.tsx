import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: vi.fn(),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));

import { ApplicationTab } from "../_components/ApplicationTab";
import { inOrder } from "./heading-order";
import { EMPTY, item, snap } from "./tab-fixtures";

afterEach(cleanup);

describe("ApplicationTab", () => {
  it("수집 전이면 개발/테스트 묶음 대신 구분 미확인 문구", () => {
    render(
      <ApplicationTab
        snapshot={snap({ devStatusCollected: false, unknown: 3 })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    expect(
      screen.getByText(
        "개발/테스트 구분 미확인 — 작업 통계가 아직 수집되지 않았습니다 (시작 전 서비스 3건)",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "개발 중" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "테스트 중" })).toBeNull();
  });

  it("안 붙음 0 건도 적는다 — 조치 문구는 붙이지 않는다", () => {
    render(
      <ApplicationTab
        snapshot={snap({ unmatchedApplication: 0 })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    expect(
      screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 서비스 0건"),
    ).toBeInTheDocument();
  });

  it("안 붙음이 있으면 한 문장으로 조치까지", () => {
    render(
      <ApplicationTab
        snapshot={snap({ unmatchedApplication: 4 })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 서비스 4건 — 서비스 마감 메뉴에서 담당자 이름을 확인하세요",
      ),
    ).toBeInTheDocument();
  });

  it("수집됐는데 미확인 건이 있으면 구분 미확인 n건 묶음", () => {
    render(
      <ApplicationTab
        snapshot={snap({ devStatusCollected: true, unknown: 2 })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "구분 미확인 2건" }),
    ).toBeInTheDocument();
  });

  it("묶음 순서", () => {
    render(
      <ApplicationTab
        snapshot={snap({ devStatusCollected: true })}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    inOrder([
      "원서접수",
      "개발 중",
      "테스트 중",
      "차주 오픈 예정",
      "운영 중",
      "차주 마감 예정",
      "원서접수 외 서비스",
      "영역 특이사항",
    ]);
  });

  it("탭 제목은 h2 크기이고 건수는 제목 밖에 자동·직접으로 나눠 적는다", () => {
    const base = snap({ devStatusCollected: true });
    render(
      <ApplicationTab
        snapshot={{
          ...base,
          application: {
            ...base.application,
            running: [item("a"), item("b")],
          },
        }}
        detail={{
          ...EMPTY,
          manual: [
            {
              id: "m1",
              area: "application",
              group_key: "running",
              title: "수동",
              note: "",
              period_start: null,
              period_end: null,
              leave_kind: null,
            },
          ],
        }}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    const h = screen.getByRole("heading", { name: "원서접수" });
    expect(h.className).toContain("text-xl");
    expect(h.className).toContain("font-bold");
    const count = screen.getByText("자동 2건 · 직접 1건");
    expect(count.className).toContain("tabular-nums");
    expect(h.contains(count)).toBe(false);
  });

  it("묶음 목록은 큰 절 사이 간격 안에 든다(gap-7 / 묶음 gap-6)", () => {
    const { container } = render(
      <ApplicationTab
        snapshot={snap()}
        detail={EMPTY}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    const root = container.firstElementChild as Element;
    expect(root.className).toContain("gap-7");
    const first = screen
      .getByRole("heading", { name: "개발 중" })
      .closest("section")?.parentElement as Element;
    expect(first.className).toContain("gap-6");
  });

  it("구분이 수집되지 않아 안 보이는 개발 묶음의 직접 추가 건은 세지 않는다", () => {
    render(
      <ApplicationTab
        snapshot={snap({ devStatusCollected: false })}
        detail={{
          ...EMPTY,
          manual: [
            {
              id: "m1",
              area: "application",
              group_key: "dev",
              title: "숨은 건",
              note: "",
              period_start: null,
              period_end: null,
              leave_kind: null,
            },
          ],
        }}
        reportId="r"
        editable
        freezeNotice={false}
      />,
    );
    expect(screen.getByText("자동 0건 · 직접 0건")).toBeInTheDocument();
  });
});

describe("ApplicationTab — 굳는 시점 안내", () => {
  it("제출 후 최종 보고 전이면 자동 묶음 위에 굳는 시점을 알린다", () => {
    render(
      <ApplicationTab
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
      <ApplicationTab
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
