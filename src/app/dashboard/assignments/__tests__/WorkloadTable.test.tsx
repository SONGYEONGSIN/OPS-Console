import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WorkloadTable } from "../WorkloadTable";
import type { WorkloadGroup } from "@/features/assignments/workload";

/**
 * 배분현황 표 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
 *
 * 판정하지 않는다. 그룹 안 평균을 머리에 적고, 편차가 큰 줄을 눈에 띄게 할 뿐이다.
 * 전체를 균등화하면 연차에 따라 의도된 차이까지 지우려 들기 때문에(§3.5), 표가
 * '고칠 것' 을 말하는 순간 잘못된 일을 부른다.
 *
 * **0 을 두 가지로 쓰지 않는다.** 건수 0 은 '일이 없다' 이고, 원천에 이름이 없어
 * 못 센 칸은 따로 적는다 — 원장 293곳 중 32곳이 `closing_services` 에 이름이 없고
 * 성적산출 44곳·상담앱 25곳은 원천 자체가 없다.
 */
const row = (o: Partial<WorkloadGroup["rows"][number]> = {}) => ({
  email: "a@x.com",
  name: "가운영",
  careerStart: "2019-03-01",
  universities: 17,
  services: 91,
  density: 5.35,
  uncounted: 0,
  week: 2,
  month: 8,
  year: 40,
  deviation: 0.1,
  ...o,
});

const groups: WorkloadGroup[] = [
  {
    group: "2",
    target: { universities: 20, density: 4 },
    rows: [row()],
  },
];

const NOW = new Date("2026-09-17T12:00:00+09:00");

describe("WorkloadTable", () => {
  it("그룹 머리에 목표를 적는다 — 견주는 기준이 줄마다 다르지 않다", () => {
    render(<WorkloadTable groups={groups} now={NOW} />);

    // 줄의 '그룹' 칸에도 같은 글자가 있어 role 로 가른다.
    const head = screen.getByRole("columnheader", { name: /2그룹/ });
    // 목표는 그룹 안 평균이라 소수가 붙는다(19.5곳). 자리를 고정해 둔다.
    expect(head.textContent).toMatch(/20\.0곳/);
    expect(head.textContent).toMatch(/4\.0/);
  });

  it("한 줄에 열 칸이 다 있다", () => {
    render(<WorkloadTable groups={groups} now={NOW} />);

    const tr = screen.getByRole("row", { name: /가운영/ });
    const cells = within(tr).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "가운영",
      "2그룹",
      "7.5년",
      "17",
      "91",
      "5.4",
      "10%",
      "2",
      "8",
      "40",
    ]);
  });

  it("편차가 임계를 넘으면 강조한다", () => {
    render(
      <WorkloadTable
        groups={[{ ...groups[0], rows: [row({ deviation: 0.45 })] }]}
        now={NOW}
      />,
    );

    expect(screen.getByRole("row", { name: /가운영/ }).className).toMatch(
      /vermilion/,
    );
  });

  it("임계 아래는 강조하지 않는다", () => {
    render(<WorkloadTable groups={groups} now={NOW} />);

    expect(screen.getByRole("row", { name: /가운영/ }).className).not.toMatch(
      /vermilion/,
    );
  });

  it("못 센 칸이 있으면 건수 옆에 적는다 — 0 이 '일이 없다' 로 읽히면 안 된다", () => {
    render(
      <WorkloadTable
        groups={[{ ...groups[0], rows: [row({ services: 0, uncounted: 3 })] }]}
        now={NOW}
      />,
    );

    expect(screen.getByText(/0 \(3칸 못 셈\)/)).toBeTruthy();
  });

  it("그룹 미설정은 목표 자리에 이유를 적는다", () => {
    render(
      <WorkloadTable
        groups={[{ group: "그룹 미설정", target: null, rows: [row()] }]}
        now={NOW}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: /그룹 미설정/ }).textContent,
    ).toMatch(/목표 없음/);
  });

  it("목표가 없으면 편차 칸도 비운다", () => {
    render(
      <WorkloadTable
        groups={[
          {
            group: "그룹 미설정",
            target: null,
            rows: [row({ deviation: null })],
          },
        ]}
        now={NOW}
      />,
    );

    const cells = within(
      screen.getByRole("row", { name: /가운영/ }),
    ).getAllByRole("cell");
    expect(cells[6].textContent).toBe("—");
  });

  it("아무도 없으면 빈 상태를 말한다", () => {
    render(<WorkloadTable groups={[]} now={NOW} />);

    expect(screen.getByText(/배정 대상이 없습니다/)).toBeTruthy();
  });
});
