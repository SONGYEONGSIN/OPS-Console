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
import { EMPTY, snap } from "./tab-fixtures";

afterEach(cleanup);

describe("ApplicationTab", () => {
  it("수집 전이면 개발/테스트 묶음 대신 구분 미확인 문구", () => {
    render(
      <ApplicationTab
        snapshot={snap({ devStatusCollected: false, unknown: 3 })}
        detail={EMPTY}
        reportId="r"
        editable
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
      />,
    );
    inOrder([
      "개발 중",
      "테스트 중",
      "차주 오픈 예정",
      "운영 중",
      "차주 마감 예정",
      "원서접수 외 서비스",
    ]);
  });
});
