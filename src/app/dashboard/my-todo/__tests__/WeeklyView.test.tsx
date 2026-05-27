import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/dashboard/my-todo",
  useSearchParams: () => new URLSearchParams(),
}));

import { WeeklyView } from "../WeeklyView";
import type { ServicesRow } from "@/features/services/schemas";

const baseService: Omit<
  ServicesRow,
  "id" | "service_id" | "service_name" | "write_start_at" | "write_end_at"
> = {
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  university_type: "4년제",
  category: "수시",
  operator_email: null,
  operator_name: null,
  developer_email: null,
  developer_name: null,
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
  source: "google_sheet_import",
  imported_at: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("WeeklyView", () => {
  it("주 시작 헤더 + 7 요일 헤더 + 빈 todos 표시", () => {
    render(
      <WeeklyView
        todos={[]}
        weekStartYmd="2026-05-18"
        canWrite={true}
        todayYmd="2026-05-19"
        services={[]}
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    expect(screen.getByText(/2026-05-18.*~/)).toBeInTheDocument();
    // 요일 헤더 7개 (월~일)
    expect(screen.getByText("월")).toBeInTheDocument();
    expect(screen.getByText("일")).toBeInTheDocument();
  });

  it("todayYmd와 일치하는 셀은 data-today='true' 표시", () => {
    render(
      <WeeklyView
        todos={[]}
        weekStartYmd="2026-05-18"
        canWrite={true}
        todayYmd="2026-05-19"
        services={[]}
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    const todayCell = screen.getByTestId("weekly-cell-2026-05-19");
    expect(todayCell.getAttribute("data-today")).toBe("true");
    const otherCell = screen.getByTestId("weekly-cell-2026-05-20");
    expect(otherCell.getAttribute("data-today")).toBe("false");
  });

  it("services write_start_at/end_at 일자에 dot + 드래그 핸들 렌더", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        service_id: 1001,
        service_name: "PIMS 원서",
        write_start_at: "2026-05-22",
        write_end_at: "2026-05-25",
      },
    ];
    render(
      <WeeklyView
        todos={[]}
        weekStartYmd="2026-05-18"
        canWrite={true}
        todayYmd="2026-05-19"
        services={services}
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    expect(
      screen.getByTestId(
        "weekly-service-start-f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "weekly-service-end-f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ),
    ).toBeInTheDocument();
    // 드롭존 존재
    expect(screen.getByTestId("weekly-drop-zone")).toBeInTheDocument();
  });

  describe("셀별 더보기/접기 (운영부 달력과 동일 패턴, MAX=4)", () => {
    // 같은 날짜에 5건 서비스를 깔아 overflow 발생
    const ymd = "2026-05-22";
    const overflowingServices: ServicesRow[] = Array.from({ length: 5 }).map(
      (_, i) => ({
        ...baseService,
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        service_id: 2000 + i,
        service_name: `서비스${i + 1}`,
        write_start_at: ymd,
        write_end_at: ymd,
      }),
    );

    it("셀 항목 ≤ MAX → '더보기' 버튼 없음", () => {
      render(
        <WeeklyView
          todos={[]}
          weekStartYmd="2026-05-18"
          canWrite={true}
          todayYmd="2026-05-19"
          services={overflowingServices.slice(0, 2)}
          onPersist={vi.fn(async () => ({ ok: true }))}
        />,
      );
      const cell = screen.getByTestId(`weekly-cell-${ymd}`);
      expect(within(cell).queryByText(/더보기/)).not.toBeInTheDocument();
    });

    it("셀 항목 > MAX → '+N 더보기' 버튼 + 보이는 항목 제한", () => {
      render(
        <WeeklyView
          todos={[]}
          weekStartYmd="2026-05-18"
          canWrite={true}
          todayYmd="2026-05-19"
          services={overflowingServices}
          onPersist={vi.fn(async () => ({ ok: true }))}
        />,
      );
      const cell = screen.getByTestId(`weekly-cell-${ymd}`);
      // 5건 start dot 중 MAX 이하만 보임
      const startDots = within(cell).queryAllByTestId(/weekly-service-start-/);
      expect(startDots.length).toBeLessThan(5);
      // 더보기 버튼 — overflow는 시작 dot 5 + 종료 dot 5 = 10건 기준 (10 - 4 = 6)
      expect(within(cell).getByText(/\+\d+ 더보기/)).toBeInTheDocument();
    });

    it("'더보기' 클릭 → 전체 표시 + '접기' 버튼 노출", () => {
      render(
        <WeeklyView
          todos={[]}
          weekStartYmd="2026-05-18"
          canWrite={true}
          todayYmd="2026-05-19"
          services={overflowingServices}
          onPersist={vi.fn(async () => ({ ok: true }))}
        />,
      );
      const cell = screen.getByTestId(`weekly-cell-${ymd}`);
      const moreBtn = within(cell).getByText(/\+\d+ 더보기/);
      fireEvent.click(moreBtn);
      // 모든 start dot 5건 보임
      const startDots = within(cell).queryAllByTestId(/weekly-service-start-/);
      expect(startDots.length).toBe(5);
      expect(within(cell).getByText("접기")).toBeInTheDocument();
    });

    it("다른 셀의 '더보기' 클릭 → 이전 셀은 자동 접힘 (한 번에 1셀)", () => {
      const ymd2 = "2026-05-23";
      const moreServices2: ServicesRow[] = Array.from({ length: 5 }).map(
        (_, i) => ({
          ...baseService,
          id: `11111111-1111-1111-1111-11111111111${i}`,
          service_id: 3000 + i,
          service_name: `다른서비스${i + 1}`,
          write_start_at: ymd2,
          write_end_at: ymd2,
        }),
      );
      render(
        <WeeklyView
          todos={[]}
          weekStartYmd="2026-05-18"
          canWrite={true}
          todayYmd="2026-05-19"
          services={[...overflowingServices, ...moreServices2]}
          onPersist={vi.fn(async () => ({ ok: true }))}
        />,
      );
      const cell1 = screen.getByTestId(`weekly-cell-${ymd}`);
      const cell2 = screen.getByTestId(`weekly-cell-${ymd2}`);

      fireEvent.click(within(cell1).getByText(/\+\d+ 더보기/));
      expect(within(cell1).getByText("접기")).toBeInTheDocument();

      fireEvent.click(within(cell2).getByText(/\+\d+ 더보기/));
      expect(within(cell2).getByText("접기")).toBeInTheDocument();
      // cell1은 접힘 상태로 복귀 → '+N 더보기' 다시 보임
      expect(within(cell1).getByText(/\+\d+ 더보기/)).toBeInTheDocument();
      expect(within(cell1).queryByText("접기")).not.toBeInTheDocument();
    });
  });
});
