import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { NewcomerRow } from "@/features/assignments/newcomers";
import type { WorkloadGroup } from "@/features/assignments/workload";

vi.mock("@/features/assignments/proposal/actions", () => ({
  requestSingleProposal: vi.fn(),
}));

import { NewAssignmentPanel } from "../NewAssignmentPanel";

/**
 * 신규배정 탭 — **주인 없는 서비스에 네 가지를 답한다.**
 *
 * 3월 배정 이후의 흐름은 모니터링이고, 중간에 들어오는 서비스만 건건히 배정한다.
 * 그때 묻는 것이 ①어느 시트에 ②언제 시작 ③어느 그룹에 ④그 그룹이 그때 여유가
 * 있나 — 넷이 한 줄에서 답해져야 관리자가 화면을 떠나지 않는다.
 */
const load = (week: number, month: number): WorkloadGroup[] => [
  {
    group: "2",
    target: { universities: 20, density: 4 },
    rows: [
      {
        email: "a@x.com",
        name: "가운영",
        careerStart: "2019-03-01",
        universities: 17,
        services: 91,
        density: 5.35,
        uncounted: 0,
        week,
        month,
        year: 40,
        deviation: 0.1,
        running: [],
      },
    ],
  },
];

const row = (o: Partial<NewcomerRow> = {}): NewcomerRow => ({
  university_name: "새대",
  work_kind: "원서접수",
  source: "not-in-ledger",
  sheet: "02. 배정리스트",
  start: "2026-10-01",
  services: ["2027 수시모집"],
  canRequest: true,
  ...o,
});

const view = (o: Partial<NewcomerRow> = {}, groups = load(2, 8)) => ({
  ...row(o),
  loadAtStart: groups as WorkloadGroup[] | null,
});

const props = (rows: ReturnType<typeof view>[]) => ({
  rows,
  academicYear: 2027,
});

describe("NewAssignmentPanel", () => {
  it("비어 있으면 왜 비었는지 적는다 — 0 은 고장과 구분이 안 된다", () => {
    render(<NewAssignmentPanel {...props([])} />);

    expect(screen.getByText(/주인 없는 서비스가 없습니다/)).toBeTruthy();
  });

  it("한 줄이 시트와 시작과 서비스를 함께 답한다", () => {
    render(<NewAssignmentPanel {...props([view()])} />);

    const tr = screen.getByText("새대").closest("tr");
    expect(tr).toBeTruthy();
    const cells = within(tr as HTMLElement);
    expect(cells.getByText("02. 배정리스트")).toBeTruthy();
    expect(cells.getByText(/10\.01/)).toBeTruthy();
    expect(cells.getByText(/2027 수시모집/)).toBeTruthy();
  });

  it("연결 안 됨 줄에는 배정 요청이 없다 — 고칠 것은 주소다", () => {
    render(
      <NewAssignmentPanel
        {...props([
          view({
            source: "ledger-unlinked",
            canRequest: false,
            // 부하표의 `가운영` 과 갈라 둔다 — 같은 이름이면 무엇을 찾았는지 모른다.
            assigneeName: "이담당",
          }),
        ])}
      />,
    );

    expect(screen.queryByRole("button", { name: /배정 요청/ })).toBeNull();
    expect(screen.getByText(/주소/)).toBeTruthy();
    expect(screen.getByText(/이담당/)).toBeTruthy();
  });

  it("주인이 없는 줄에는 배정 요청이 있다", () => {
    render(<NewAssignmentPanel {...props([view()])} />);

    expect(screen.getByRole("button", { name: /배정 요청/ })).toBeTruthy();
  });

  it("펼치면 **그때**의 여유를 보여준다 — '지금 여유 있나' 가 아니다", () => {
    /*
     * 12월에 시작하는 서비스를 9월 부하로 판단하면, 그 사람이 12월에 몇 건을 들고
     * 있는지는 아무도 안 본 채 배정된다. 창을 서비스 시작일로 옮겨 다시 잰다.
     */
    render(<NewAssignmentPanel {...props([view()])} />);

    const details = screen.getByText(/2026-10-01 기준/);
    expect(details).toBeTruthy();
    expect(screen.getByText(/가운영/)).toBeTruthy();
  });

  it("시작을 모르면 그때 여유를 못 잰다고 적는다 — 빈 표로 두지 않는다", () => {
    render(
      <NewAssignmentPanel
        {...props([view({ start: null, services: [] }, null as never)])}
      />,
    );

    expect(screen.getByText(/시작을 몰라/)).toBeTruthy();
  });

  it("원장에 비슷한 이름이 있으면 줄에 적는다 — 대부분이 표기 갈림이다", () => {
    /*
     * 시트 밖 줄 26개 중 23개가 `충남대학교 대학원` ↔ `충남대학교` 같은 표기
     * 갈림이다(실측). 적지 않으면 관리자가 매번 원장을 뒤져 확인해야 하고,
     * 그러다 진짜 새 대학 하나를 똑같이 무시하게 된다.
     */
    render(
      <NewAssignmentPanel
        {...props([
          view({
            university_name: "청심국제중고등학교",
            similarNames: ["청심국제고등학교", "청심국제중학교"],
          }),
        ])}
      />,
    );

    expect(screen.getByText(/비슷한 이름/)).toBeTruthy();
    expect(screen.getByText(/청심국제중학교/)).toBeTruthy();
  });

  it("머리에 건수를 적는다 — 급한 순서가 화면 순서다", () => {
    render(
      <NewAssignmentPanel
        {...props([view(), view({ university_name: "다른대" })])}
      />,
    );

    expect(screen.getByText(/2곳/)).toBeTruthy();
  });
});
