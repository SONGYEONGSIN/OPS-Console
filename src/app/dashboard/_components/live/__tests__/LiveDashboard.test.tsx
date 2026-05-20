import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveDashboard } from "../LiveDashboard";
import type { ListRow } from "../../patterns/ListPattern";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

const sampleRow: ListRow = {
  id: "s1",
  name: "건국대학교",
  status: "active",
  owner: "송영석",
  serviceName: "정시 1차",
};

describe("LiveDashboard", () => {
  it("3-column 그리드 + 카드 1개 + placeholder 노출", () => {
    render(
      <LiveDashboard
        mine={false}
        cards={[
          {
            label: "서비스",
            count: 1,
            variant: "services",
            columns: [
              { key: "date", label: "마감" },
              { key: "title", label: "대학" },
            ],
            simpleRows: [{ id: "s1", date: "5.20", title: "건국대" }],
            listRowsById: { s1: sampleRow },
          },
        ]}
      />,
    );
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getAllByText(/도메인 추가 자리/).length).toBeGreaterThan(0);
  });

  it("row 클릭 → 인스펙터 패널 open (row.name 노출)", () => {
    render(
      <LiveDashboard
        mine={false}
        cards={[
          {
            label: "서비스",
            count: 1,
            variant: "services",
            columns: [
              { key: "title", label: "대학" },
            ],
            simpleRows: [{ id: "s1", title: "건국대" }],
            listRowsById: { s1: sampleRow },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("건국대"));
    // InspectorChrome가 row.name(건국대학교)를 h3로 표시
    expect(
      screen.getAllByText("건국대학교").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
