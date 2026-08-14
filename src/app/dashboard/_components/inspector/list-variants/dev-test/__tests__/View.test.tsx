import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/entertest/actions", () => ({
  requestEntertestRun: vi.fn(),
  setMyEntertestAccount: vi.fn(),
  cancelEntertestRun: vi.fn(),
}));

import { DevTestView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";

const row: ListRow = {
  id: "s-1",
  name: "수시모집",
  status: "active",
  owner: "",
  serviceIdNum: 12345,
  universityName: "서강대학교",
  serviceName: "수시모집",
  entertestAccount: "jt29001",
  entertestRuns: [],
};

describe("DevTestView", () => {
  it("대학·서비스 헤더와 테스트 URL, 실행 버튼을 렌더한다", () => {
    render(<DevTestView row={row} />);
    // 대학명/서비스명은 서비스 기본 + 테스트 대상 두 곳에 노출됨
    expect(screen.getAllByText(/서강대학교/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/수시모집/).length).toBeGreaterThan(0);
    // 테스트 URL에 service_id 포함
    expect(
      screen.getByDisplayValue(/entertest\.jinhakapply\.com\/Notice\/12345/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /테스트 실행/ }),
    ).toBeInTheDocument();
  });

  it("공통원서 서비스는 nstest 주소를 보여준다", () => {
    // 공통원서는 entertest가 아닌 별도 테스트 시스템에서 열린다.
    render(<DevTestView row={{ ...row, applicationType: "공통원서" }} />);
    expect(
      screen.getByDisplayValue("https://nstest.jinhakapply.com/Notice/12345/A"),
    ).toBeInTheDocument();
  });

  it("계정 미등록이면 실행 버튼 disabled + 안내", () => {
    render(<DevTestView row={{ ...row, entertestAccount: null }} />);
    expect(screen.getByRole("button", { name: /테스트 실행/ })).toBeDisabled();
    expect(screen.getByText(/대역 계정을 먼저 등록/)).toBeInTheDocument();
  });

  it("계정 등록/수정 폼을 인스펙터 안에 노출한다", () => {
    render(<DevTestView row={row} />);
    expect(screen.getByText("테스트 대역 계정")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
  });
});

type Run = ListRow["entertestRuns"] extends (infer R)[] ? R : never;

function runWith(status: string, requestedBy = "kim"): Run {
  return {
    id: "r1",
    service_id: 1,
    status,
    requested_by: requestedBy,
    requested_at: "2026-06-18T09:00:00Z",
    result: null,
    error_message: null,
  } as Run;
}

describe("DevTestView — 상태 배지 톤", () => {
  it("완료는 완료 톤(검정)이다", () => {
    render(<DevTestView row={{ ...row, entertestRuns: [runWith("done")] }} />);
    expect(screen.getByText("완료").className).toContain(BADGE_TONE.done);
  });

  it("오류는 주의 톤이다 — 실패와 같은 색이어야 한다", () => {
    render(<DevTestView row={{ ...row, entertestRuns: [runWith("error")] }} />);
    expect(screen.getByText("오류").className).toContain(BADGE_TONE.attention);
  });

  it("실행 중은 진행 톤이다", () => {
    render(
      <DevTestView row={{ ...row, entertestRuns: [runWith("running")] }} />,
    );
    expect(screen.getByText("실행 중").className).toContain(
      BADGE_TONE.progress,
    );
  });
});

describe("DevTestView — 대기 요청 취소", () => {
  const rowWith = (run: Run): ListRow => ({ ...row, entertestRuns: [run] });

  it("본인이 요청한 대기 건에는 취소 버튼이 있다", () => {
    render(
      <DevTestView
        row={rowWith(runWith("pending", "me@x.com"))}
        currentUserEmail="me@x.com"
      />,
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("이미 실행이 시작된 건에는 취소 버튼이 없다", () => {
    // running은 폴러가 이미 집어간 상태 — 되돌릴 수 없다.
    render(
      <DevTestView
        row={rowWith(runWith("running", "me@x.com"))}
        currentUserEmail="me@x.com"
      />,
    );
    expect(screen.queryByRole("button", { name: "취소" })).toBeNull();
  });

  it("남의 대기 요청에는 취소 버튼이 없다", () => {
    render(
      <DevTestView
        row={rowWith(runWith("pending", "other@x.com"))}
        currentUserEmail="me@x.com"
      />,
    );
    expect(screen.queryByRole("button", { name: "취소" })).toBeNull();
  });

  it("admin은 남의 대기 요청도 취소할 수 있다", () => {
    render(
      <DevTestView
        row={rowWith(runWith("pending", "other@x.com"))}
        currentUserEmail="me@x.com"
        currentUserPermission="admin"
      />,
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });
});
