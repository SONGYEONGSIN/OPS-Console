import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/entertest/actions", () => ({
  requestEntertestRun: vi.fn(),
}));

import { DevTestView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "s-1",
  name: "수시모집",
  status: "active",
  owner: "",
  serviceIdNum: 12345,
  universityName: "서강대학교",
  serviceName: "수시모집",
  entertestAccountReady: true,
  entertestRuns: [],
};

describe("DevTestView", () => {
  it("대학·서비스 헤더와 테스트 URL, 실행 버튼을 렌더한다", () => {
    render(<DevTestView row={row} />);
    expect(screen.getByText(/서강대학교/)).toBeInTheDocument();
    expect(screen.getByText(/수시모집/)).toBeInTheDocument();
    // 테스트 URL에 service_id 포함
    expect(
      screen.getByDisplayValue(/entertest\.jinhakapply\.com\/Notice\/12345/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /테스트 실행/ }),
    ).toBeInTheDocument();
  });

  it("계정 미등록(accountReady=false)이면 실행 버튼 disabled + 안내", () => {
    render(<DevTestView row={{ ...row, entertestAccountReady: false }} />);
    expect(screen.getByRole("button", { name: /테스트 실행/ })).toBeDisabled();
    expect(screen.getByText(/테스트 계정을 먼저 등록/)).toBeInTheDocument();
  });
});
