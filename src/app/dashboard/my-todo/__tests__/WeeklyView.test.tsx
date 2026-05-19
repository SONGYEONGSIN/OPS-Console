import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
});
