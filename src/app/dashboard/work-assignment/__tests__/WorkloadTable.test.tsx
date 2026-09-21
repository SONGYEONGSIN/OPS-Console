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
  running: [],
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

/** 현재 학년도 기본값. 학년도별 갈림은 아래 describe 가 따로 본다. */
const props = () => ({
  groups,
  now: NOW,
  academicYear: 2027,
  years: [2027, 2026] as const,
  isPast: false,
});

describe("WorkloadTable", () => {
  it("그룹 머리에 목표를 적는다 — 견주는 기준이 줄마다 다르지 않다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    // 줄의 '그룹' 칸에도 같은 글자가 있어 role 로 가른다.
    const head = screen.getByRole("columnheader", { name: /2그룹/ });
    // 목표는 그룹 안 평균이라 소수가 붙는다(19.5곳). 자리를 고정해 둔다.
    expect(head.textContent).toMatch(/20\.0곳/);
    expect(head.textContent).toMatch(/4\.0/);
  });

  it("한 줄에 열 칸이 다 있다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

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
        {...props()}
        groups={[{ ...groups[0], rows: [row({ deviation: 0.45 })] }]}
        now={NOW}
      />,
    );

    expect(screen.getByRole("row", { name: /가운영/ }).className).toMatch(
      /vermilion/,
    );
  });

  it("임계 아래는 강조하지 않는다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    expect(screen.getByRole("row", { name: /가운영/ }).className).not.toMatch(
      /vermilion/,
    );
  });

  it("못 센 칸이 있으면 건수 옆에 적는다 — 0 이 '일이 없다' 로 읽히면 안 된다", () => {
    render(
      <WorkloadTable
        {...props()}
        groups={[{ ...groups[0], rows: [row({ services: 0, uncounted: 3 })] }]}
        now={NOW}
      />,
    );

    expect(screen.getByText(/0 \(3칸 못 셈\)/)).toBeTruthy();
  });

  it("그룹 미설정은 목표 자리에 이유를 적는다", () => {
    render(
      <WorkloadTable
        {...props()}
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
        {...props()}
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
    render(<WorkloadTable {...props()} groups={[]} />);

    expect(screen.getByText(/배정 대상이 없습니다/)).toBeTruthy();
  });
});


/**
 * 학년도 전환 — **원천이 갈리므로 화면이 그것을 말해야 한다.**
 *
 * 2026학년도 2,511건에서 2027학년도 983건으로 떨어지는데, 말 안 하면 **물량이
 * 60% 줄었다**고 읽는다. 실제로는 표가 바뀐 것이다(`services` 는 2026-02-28 에
 * 멈춘 시트 임포트, `closing_services` 는 스크랩 시작 뒤부터 쌓이는 미러).
 */
describe("WorkloadTable — 학년도", () => {
  it("고를 수 있는 학년도를 모두 보여주고 지금 것을 표시한다", () => {
    render(<WorkloadTable {...props()} />);
    expect(screen.getByRole("link", { name: /2026학년도/ })).toHaveAttribute(
      "href",
      expect.stringContaining("year=2026"),
    );
    // 현재 학년도는 링크가 아니라 현재 위치 표시다.
    expect(
      screen.queryByRole("link", { name: /2027학년도/ }),
    ).not.toBeInTheDocument();
  });

  it("현재 학년도는 서비스마감이 원천이라고 적는다", () => {
    render(<WorkloadTable {...props()} />);
    expect(screen.getByText(/서비스마감/)).toBeInTheDocument();
  });

  it("과거 학년도는 서비스목록이 원천이고 담당자도 그쪽이라고 적는다", () => {
    render(
      <WorkloadTable {...props()} academicYear={2026} isPast />,
    );
    const note = screen.getByText(/서비스목록/);
    expect(note.textContent).toMatch(/담당자/);
  });

  it("과거 학년도는 목표를 내지 않는 이유를 적는다", () => {
    // 목표 칸이 그냥 비면 '계산이 안 됐다' 로 읽힌다 — 안 내는 것이 의도다.
    render(<WorkloadTable {...props()} academicYear={2026} isPast />);
    expect(screen.getByText(/연차 그룹/)).toBeInTheDocument();
  });
});

/**
 * 진행 상세 — 사용자가 원한 것은 *"주간/월별 통계 **및 상세 리스트**"* 다.
 * '이번 주 3건' 에서 멈추면 어느 대학의 무엇인지 볼 곳이 없다.
 */
describe("WorkloadTable — 진행 상세", () => {
  const withRunning = (running: WorkloadGroup["rows"][number]["running"]) => [
    { group: "2", target: { universities: 20, density: 4 }, rows: [row({ running })] },
  ];

  const two = [
    {
      university_name: "가대",
      service_name: "2027학년도 수시모집",
      work_kind: "원서접수",
      start: "2026-09-15",
      end: "2026-09-18",
      inWeek: true,
    },
    {
      university_name: "나대",
      service_name: "2027학년도 정시모집",
      work_kind: "원서접수",
      start: "2026-09-25",
      end: "2026-09-28",
      inWeek: false,
    },
  ];

  it("대학·서비스명·기간을 적는다", () => {
    render(<WorkloadTable {...props()} groups={withRunning(two)} />);
    expect(screen.getByText("2027학년도 수시모집")).toBeInTheDocument();
    expect(screen.getByText(/가대/)).toBeInTheDocument();
    expect(screen.getByText(/09\.15/)).toBeInTheDocument();
  });

  it("이번 주에 도는 것을 가려낸다", () => {
    render(<WorkloadTable {...props()} groups={withRunning(two)} />);
    const susi = screen.getByText("2027학년도 수시모집").closest("tr")!;
    expect(within(susi).getByText("이번 주")).toBeInTheDocument();
    const jungsi = screen.getByText("2027학년도 정시모집").closest("tr")!;
    expect(within(jungsi).queryByText("이번 주")).not.toBeInTheDocument();
  });

  it("진행이 없으면 그렇게 적는다 — 빈 칸으로 두지 않는다", () => {
    render(<WorkloadTable {...props()} groups={withRunning([])} />);
    expect(screen.getByText(/이번 달에 도는 서비스가 없습니다/)).toBeInTheDocument();
  });
});
