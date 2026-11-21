import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { UnmatchedServicesPanel } from "../_components/UnmatchedServicesPanel";
import type { ClosingLite } from "@/features/ops-weekly/auto-lists/application";
import type { PimsLite } from "@/features/ops-weekly/auto-lists/pims";

afterEach(cleanup);

const closing = (id: number, over: Partial<ClosingLite> = {}): ClosingLite => ({
  service_id: id,
  university_name: `대학${id}`,
  service_name: `서비스${id}`,
  operator_name: "퇴사자",
  write_start_at: "2026-11-23T00:00:00Z",
  write_end_at: "2026-12-10T00:00:00Z",
  pay_end_at: null,
  ...over,
});
const pims = (id: number, over: Partial<PimsLite> = {}): PimsLite => ({
  service_id: id,
  university_name: `발표대학${id}`,
  service_name: `발표서비스${id}`,
  operator_name: "누군가",
  last_announce_at: "2026-11-20T01:00:00Z",
  ...over,
});

describe("UnmatchedServicesPanel", () => {
  it("설정 탭의 다른 패널과 같은 머리 — 앵커 id, h2, 설명에 현재 기준", () => {
    render(
      <UnmatchedServicesPanel unmatched={{ application: [], pims: [] }} />,
    );
    const region = screen.getByRole("region", { name: "지정 안된 서비스" });
    expect(region).toHaveAttribute("id", "unmatched");
    const t = region.className.split(/\s+/);
    expect(t).toEqual(
      expect.arrayContaining(["flex", "scroll-mt-4", "flex-col", "gap-3"]),
    );
    const h = within(region).getByRole("heading", {
      level: 2,
      name: "지정 안된 서비스",
    });
    expect(h.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xl", "font-bold", "text-ink"]),
    );
    expect(region).toHaveTextContent("현재 기준");
    expect(region).toHaveTextContent(
      "서비스마감 메뉴에서 담당자 이름을 고치세요",
    );
  });

  it("두 묶음 머리는 건수를 적고, 건수는 목록 길이다", () => {
    render(
      <UnmatchedServicesPanel
        unmatched={{
          application: [closing(1), closing(2), closing(3)],
          pims: [pims(9)],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "원서접수 3건" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "합격자 발표 1건" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("table", { name: "원서접수 지정 안된 서비스" }),
      ).getAllByRole("row"),
    ).toHaveLength(4);
  });

  it("원서접수 표 — 담당자 원문, 비었으면 (비어 있음), 접수기간은 KST", () => {
    render(
      <UnmatchedServicesPanel
        unmatched={{
          application: [
            closing(1),
            closing(2, { operator_name: null }),
            closing(3, { operator_name: "  " }),
            closing(4, { write_end_at: "2027-12-10T00:00:00Z" }),
          ],
          pims: [],
        }}
      />,
    );
    const table = screen.getByRole("table", {
      name: "원서접수 지정 안된 서비스",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["대학", "서비스명", "서비스마감 담당자", "접수기간"]);
    expect(within(table).getAllByText("퇴사자")).toHaveLength(2);
    expect(within(table).getAllByText("(비어 있음)")).toHaveLength(2);
    expect(within(table).getAllByText("2026.11.23 ~ 12.10")).toHaveLength(3);
    expect(
      within(table).getByText("2026.11.23 ~ 2027.12.10"),
    ).toBeInTheDocument();
  });

  it("발표 표 — 대학·서비스명·담당자·발표일", () => {
    render(
      <UnmatchedServicesPanel
        unmatched={{
          application: [],
          pims: [pims(9), pims(10, { operator_name: null })],
        }}
      />,
    );
    const table = screen.getByRole("table", {
      name: "합격자 발표 지정 안된 서비스",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["대학", "서비스명", "담당자", "발표일"]);
    expect(within(table).getAllByText("2026.11.20")).toHaveLength(2);
    expect(within(table).getByText("(비어 있음)")).toBeInTheDocument();
  });

  it("표는 가로 스크롤 래퍼 안, SubmissionTable 과 같은 표 모양", () => {
    render(
      <UnmatchedServicesPanel
        unmatched={{ application: [closing(1)], pims: [pims(9)] }}
      />,
    );
    for (const name of [
      "원서접수 지정 안된 서비스",
      "합격자 발표 지정 안된 서비스",
    ]) {
      const table = screen.getByRole("table", { name });
      expect(table.parentElement?.className).toContain("overflow-x-auto");
      expect(table.className).toContain("min-w-[34rem]");
      expect(table.className).toContain("w-full");
      const bodyRow = within(table).getAllByRole("row")[1];
      expect(bodyRow.className).toContain("hover:bg-line-soft");
      expect(bodyRow.className).toContain("border-line-soft");
    }
  });

  it("0건이면 표 대신 한 줄", () => {
    render(
      <UnmatchedServicesPanel unmatched={{ application: [], pims: [] }} />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    const none = screen.getAllByText("지정 안된 서비스가 없습니다");
    expect(none).toHaveLength(2);
    expect(none[0].className).toContain("text-muted");
    expect(
      screen.getByRole("heading", { level: 3, name: "원서접수 0건" }),
    ).toBeInTheDocument();
  });

  it("목록을 읽지 않았으면(null) 0건이라 말하지 않고 안 불러왔다고 적는다", () => {
    render(<UnmatchedServicesPanel unmatched={null} />);
    expect(screen.getByText("목록을 불러오지 않았습니다")).toBeInTheDocument();
    expect(screen.queryByText("지정 안된 서비스가 없습니다")).toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("스크롤 목적지: lg 미만은 scroll-mt-4, lg 이상은 고정 KPI 바 높이만큼", () => {
    render(<UnmatchedServicesPanel unmatched={{ application: [], pims: [] }} />);
    const t = screen
      .getByRole("region", { name: "지정 안된 서비스" })
      .className.split(/\s+/);
    expect(t).toContain("scroll-mt-4");
    expect(t).toContain("lg:scroll-mt-[calc(var(--ops-kpi-h,12rem)_+_0.5rem)]");
  });
});
