import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../_components/patterns/ListPattern";
import type { TestableService } from "@/features/entertest/queries";

const h = vi.hoisted(() => ({
  listTestableServices: vi.fn(),
  listDevControlAnalyses: vi.fn(),
  listLatestDevControlRequests: vi.fn(),
}));

vi.mock("@/features/entertest/queries", () => ({
  listTestableServices: h.listTestableServices,
}));
vi.mock("@/features/dev-controls/queries", () => ({
  listDevControlAnalyses: h.listDevControlAnalyses,
}));
vi.mock("@/features/dev-controls/requests-query", () => ({
  listLatestDevControlRequests: h.listLatestDevControlRequests,
}));
vi.mock("../../_components/patterns/ListPattern", () => ({
  ListPattern: ({
    data,
    inlineFilters,
  }: {
    data: { rows: ListRow[] };
    inlineFilters?: ReactNode;
  }) => (
    <div>
      <div data-testid="rows">
        {data.rows.map((r) => (
          <span key={r.id}>{r.universityName}</span>
        ))}
      </div>
      <div data-testid="inline-filters">{inlineFilters}</div>
    </div>
  ),
}));
vi.mock("../DevControlSearch", () => ({ DevControlSearch: () => null }));
vi.mock("@/components/common/ListPagination", () => ({
  ListPagination: () => null,
}));
vi.mock("@/components/common/ScopeChips", () => ({
  ScopeChips: ({ total, mineLabel }: { total: number; mineLabel: string }) => (
    <div data-testid="scope-chips">{`${mineLabel}:${total}`}</div>
  ),
}));

import { DevControlSection } from "../DevControlSection";

function service(over: Partial<TestableService>): TestableService {
  return {
    service_id: 1,
    university_name: "가대학교",
    service_name: "수시",
    category: null,
    region: null,
    university_type: null,
    admission_type: null,
    operator_name: null,
    write_start_at: null,
    write_end_at: null,
    pay_start_at: null,
    pay_end_at: null,
    ...over,
  };
}

const services = [
  service({ service_id: 1, university_name: "내대학교", operator_name: "홍길동" }),
  service({ service_id: 2, university_name: "남대학교", operator_name: "김철수" }),
];

describe("DevControlSection — 스코프 필터", () => {
  beforeEach(() => {
    h.listTestableServices.mockResolvedValue(services);
    h.listDevControlAnalyses.mockResolvedValue([]);
    h.listLatestDevControlRequests.mockResolvedValue(new Map());
  });

  it("mine 미지정(기본)이면 본인 담당 대학만 렌더", async () => {
    render(await DevControlSection({ myName: "홍길동" }));
    expect(screen.getByText("내대학교")).toBeInTheDocument();
    expect(screen.queryByText("남대학교")).not.toBeInTheDocument();
  });

  it('mine="false"면 전체 렌더', async () => {
    render(await DevControlSection({ mine: "false", myName: "홍길동" }));
    expect(screen.getByText("내대학교")).toBeInTheDocument();
    expect(screen.getByText("남대학교")).toBeInTheDocument();
  });

  it("ScopeChips를 inlineFilters로 렌더하고 total은 필터 후 건수", async () => {
    render(await DevControlSection({ myName: "홍길동" }));
    expect(screen.getByTestId("scope-chips")).toHaveTextContent("내 대학:1");
  });

  it("로그인 운영자 이름이 없으면 mine 기본이어도 전체 렌더", async () => {
    render(await DevControlSection({ myName: null }));
    expect(screen.getByText("내대학교")).toBeInTheDocument();
    expect(screen.getByText("남대학교")).toBeInTheDocument();
  });
});
