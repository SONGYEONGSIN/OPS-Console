import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WorkloadTable } from "../WorkloadTable";
import type { WorkloadGroup } from "@/features/assignments/workload";
import type { SheetSummaryRow } from "@/features/assignments/sheet-summary";

/**
 * 배정현황 표 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
 *
 * 판정하지 않는다. 그룹 안 평균을 머리에 적고, 편차가 큰 줄을 눈에 띄게 할 뿐이다.
 * 전체를 균등화하면 연차에 따라 의도된 차이까지 지우려 들기 때문에(§3.5), 표가
 * '고칠 것' 을 말하는 순간 잘못된 일을 부른다.
 *
 * **0 을 두 가지로 쓰지 않는다.** 건수 0 은 '일이 없다' 이고, 원천에 이름이 없어
 * 못 센 칸은 따로 적는다 — 원장 293곳 중 32곳이 `closing_services` 에 이름이 없고
 * 성적산출 44곳·상담앱 25곳은 원천 자체가 없다.
 *
 * 골격은 **운영리포트**를 옮겼다(사용자 요구 2026-09-22) — 상단 KPI 카드 → 표 →
 * 상세. 아홉 칸이 숫자만 늘어서 있어 무엇을 볼지 알 수 없었다.
 */
const row = (o: Partial<WorkloadGroup["rows"][number]> = {}) => ({
  email: "a@x.com",
  name: "가운영",
  careerStart: "2019-03-01",
  universities: 17,
  universityNames: ["가대학교", "나대학교"],
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

const sheets: SheetSummaryRow[] = [
  {
    kind: "원서접수",
    sheet: "02. 배정리스트",
    universities: 293,
    services: 568,
  },
  { kind: "대학원", sheet: "03. 대학원", universities: 49, services: 411 },
  { kind: "PIMS", sheet: "04. PIMS", universities: 81, services: 133 },
  { kind: "성적산출", sheet: "06. 성적산출", universities: 44, services: null },
];

/** 현재 학년도 기본값. 학년도별 갈림은 아래 describe 가 따로 본다. */
const props = () => ({
  groups,
  summary: { people: 22, universities: 286, services: 1101 },
  sheets,
  now: NOW,
  academicYear: 2027,
  isPast: false,
  unmatched: { services: 0, keys: 0 },
  query: "",
});

/**
 * 상단 KPI — 운영리포트 골격의 앞쪽. **표를 보기 전에 총량을 준다.**
 *
 * 카드 값은 **전원 기준**이라 검색과 무관하다(`summarizeWorkload`). 검색으로 좁힌
 * 줄로 내면 한 사람을 찾을 때 '배정 대상 1명' 이 되어 요약이 요약을 그만둔다.
 */
describe("WorkloadTable — 상단 카드", () => {
  /**
   * 카드 묶음으로 좁혀 본다.
   *
   * 시트별 현황이 붙으면서 `담당 대학`·`서비스 물량` 이 화면에 **두 번** 나온다 —
   * 그 표가 이 카드 둘을 쪼갠 것이라 같은 말을 쓰는 것이 맞다. 예전에는 라벨이
   * 유일하다는 데 기대 `getByText` 로 집었는데, 그건 화면이 자라면 깨지는 가정이다.
   */
  const cards = () => screen.getByRole("group", { name: /요약/ });

  it("세 장을 띄운다 — 사람·대학·건수", () => {
    render(
      <WorkloadTable {...props()} unmatched={{ services: 15, keys: 7 }} />,
    );

    for (const label of ["배정 대상", "담당 대학", "서비스 물량"]) {
      expect(within(cards()).getByText(label)).toBeInTheDocument();
    }
  });

  it("안 붙음은 카드가 아니다 — 카드 아래 문구가 든다", () => {
    /*
     * 사용자 지시 2026-09-23. 숫자 하나뿐인 카드가 옆의 시트별 카드 높이에 맞춰
     * 늘어나 속이 빈 채로 서 있었다. 값은 사라지지 않고 카드 묶음 아래 문구로 간다.
     */
    render(
      <WorkloadTable {...props()} unmatched={{ services: 15, keys: 7 }} />,
    );

    expect(within(cards()).queryByText("안 붙음")).toBeNull();
    expect(screen.getByText(/안 붙은 건수/)).toBeInTheDocument();
  });

  it("카드는 전원 기준이다 — 검색해도 안 움직인다", () => {
    render(
      <WorkloadTable
        {...props()}
        groups={[{ ...groups[0], rows: [row()] }]}
        query="가운"
      />,
    );

    // 표에는 한 줄만 남았지만 카드는 22명·286곳 그대로다.
    expect(within(cards()).getByText("22")).toBeInTheDocument();
    expect(within(cards()).getByText("286")).toBeInTheDocument();
  });

  it("안 붙음이 0 이어도 문구가 그 사실을 말한다 — 0 도 알릴 값이다", () => {
    /*
     * 카드를 걷었다고 0 까지 지우면 안 된다. '안 붙은 것이 없다' 와 '아직 안 세어
     * 봤다' 가 화면에서 같아진다 — 231건이 사라진 것을 못 봤던 이유가 그것이다.
     */
    render(<WorkloadTable {...props()} />);

    expect(screen.getByText(/안 붙은 건수/).textContent).toMatch(/0건/);
  });
});

describe("안 붙은 건수", () => {
  /**
   * **조용히 빠지면 아무도 못 본다.** 실측(2026-09-21)에서 마감 983건 중 231건
   * (23.5%)이 어느 담당자에게도 안 붙어 있었는데, 표의 합만 보면 멀쩡했다 —
   * 원천 건수와 견줄 자리가 화면에 없었기 때문이다.
   */
  it("안 붙은 건수가 있으면 적고, 무엇을 하라고 말한다", () => {
    render(
      <WorkloadTable {...props()} unmatched={{ services: 52, keys: 10 }} />,
    );

    expect(screen.getByText(/52건/)).toBeTruthy();
    expect(screen.getByText(/10곳/)).toBeTruthy();
  });

  it("전부 붙었으면 설명 줄을 띄우지 않는다 — 0 은 알릴 것이 아니다", () => {
    render(<WorkloadTable {...props()} />);

    expect(screen.queryByText(/배정 시트에/)).toBeNull();
  });
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

  /**
   * 아홉 칸에서 **일곱 칸**으로 줄였다(사용자 요구 2026-09-22 — "한눈에 안 들어온다").
   *
   * `경력` 은 상세로 내렸다 — 견주는 숫자가 아니라 사람을 설명하는 값이고, 그룹
   * 머리가 이미 연차를 말한다. `올해` 는 **`서비스 건수` 와 거의 같은 값**이라
   * (둘 다 그 해 전량) 나란히 두면 다른 것을 센 줄 알고 둘을 비교하게 된다.
   */
  it("한 줄에 일곱 칸이다 — 경력·올해가 빠졌다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    const tr = screen.getByRole("row", { name: /가운영/ });
    const cells = within(tr).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "가운영",
      "17",
      "91",
      "5.4",
      "10%",
      "2",
      "8",
    ]);
  });

  it("진행 중 머리글이 무엇을 세는지 말한다 — `주`·`월` 만으로는 모른다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toContain("이번 주");
    expect(heads).toContain("이번 달");
    // 한 글자 머리글은 숫자만 남기고 뜻을 지운다.
    expect(heads).not.toContain("주");
    expect(heads).not.toContain("월");
    expect(heads).not.toContain("연");
  });

  it("서비스 건수가 그 해 전량이라고 말한다 — `올해` 열을 걷은 이유다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    expect(
      screen.getByText(/서비스 건수는 그 학년도 전량/),
    ).toBeInTheDocument();
  });

  /**
   * **목표 대비를 막대로 그린다**(사용자 선택 2026-09-22). 퍼센트만 있으면 스무 줄을
   * 눈으로 견줘야 하고, 그게 '한눈에 안 들어온다' 의 절반이었다.
   */
  it("목표 대비를 막대로도 그린다 — 숫자만으로는 줄끼리 못 견준다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    const bar = screen.getByRole("meter", { name: /가운영/ });
    expect(bar).toHaveAttribute("aria-valuenow", "10");
  });

  it("목표가 없으면 막대를 그리지 않는다 — 기준 없는 막대는 거짓말이다", () => {
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
      />,
    );

    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("경력은 상세에 있다 — 표에서 내렸을 뿐 지운 것이 아니다", () => {
    render(<WorkloadTable {...props()} groups={groups} />);

    const detail = screen.getByText(/가운영/, { selector: "summary *" });
    expect(detail.closest("details")!.textContent).toMatch(/7\.5년/);
  });

  it("강조가 무엇인지 화면이 말한다 — 색만으로는 이유를 알 수 없다", () => {
    render(
      <WorkloadTable
        {...props()}
        groups={[{ ...groups[0], rows: [row({ deviation: 0.45 })] }]}
      />,
    );

    expect(screen.getByText(/목표 대비 40%/)).toBeTruthy();
  });

  it("편차가 임계를 넘으면 강조한다", () => {
    render(
      <WorkloadTable
        {...props()}
        groups={[{ ...groups[0], rows: [row({ deviation: 0.45 })] }]}
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
      />,
    );

    expect(screen.getByText(/0 \(3칸 못 셈\)/)).toBeTruthy();
  });

  it("그룹 미설정은 목표 자리에 이유를 적는다", () => {
    render(
      <WorkloadTable
        {...props()}
        groups={[{ group: "그룹 미설정", target: null, rows: [row()] }]}
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
      />,
    );

    // 자리를 숫자로 집으면 열이 하나 늘거나 줄 때마다 엉뚱한 칸을 본다(그룹 열을
    // 걷었을 때 이 단언이 '2' 를 읽고 통과할 뻔했다). 머리글로 자리를 찾는다.
    //
    // **그 표 안에서** 찾는다 — 화면에 표가 둘(시트별 현황이 앞선다)이라, 전체에서
    // 집으면 앞 표의 머리글 셋만큼 자리가 밀린다.
    const heads = within(screen.getByRole("table", { name: /사람별/ }))
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    const cells = within(
      screen.getByRole("row", { name: /가운영/ }),
    ).getAllByRole("cell");
    expect(cells[heads.indexOf("목표 대비")].textContent).toBe("—");
  });

  it("아무도 없으면 빈 상태를 말한다", () => {
    render(<WorkloadTable {...props()} groups={[]} />);

    expect(screen.getByText(/배정 대상이 없습니다/)).toBeTruthy();
  });

  /**
   * 검색 결과가 비었을 때 '배정 대상이 없습니다' 로 떨어지면 **조직 설정을 보러
   * 간다.** 찾는 말이 없는 것과 아무도 없는 것은 다른 사건이다.
   */
  it("검색 결과가 없으면 검색어를 되짚어 준다", () => {
    render(<WorkloadTable {...props()} groups={[]} query="없는사람" />);

    const msg = screen.getByText(/없는사람/);
    expect(msg.textContent).toMatch(/찾지 못했습니다|없습니다/);
    expect(screen.queryByText(/조직 · 권한/)).toBeNull();
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
  /**
   * 학년도 고르기와 검색은 **조작줄로 옮겼다**(사용자 지적 2026-09-22) — 다른 목록
   * 메뉴가 검색창·필터를 섹션 밖 한 줄에 두는데 이 화면만 섹션 머리에 끼워 넣어
   * 자리가 달랐다. 표는 무엇을 보는지 말하기만 한다.
   */
  it("학년도 칩과 검색창을 표가 들지 않는다 — 조작줄이 든다", () => {
    render(<WorkloadTable {...props()} />);

    expect(screen.queryByRole("link", { name: /학년도/ })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("어느 해를 보는지 머리가 적는다 — 셀렉트는 스크롤하면 사라진다", () => {
    /*
     * 조작줄에 학년도 셀렉트가 있어도 표가 적는다. 표를 내려 보는 동안 셀렉트가
     * 화면 밖으로 나가고, 그 상태에서 2026 과 2027 의 화면은 숫자만 다르다 —
     * 2,511 건과 983 건을 같은 해로 보면 **물량이 60% 줄었다**고 읽는다.
     */
    render(<WorkloadTable {...props()} academicYear={2026} />);

    expect(screen.getByText(/2026학년도/)).toBeInTheDocument();
  });

  it("담당 대학·서비스 물량 카드가 시트별로 갈라 적는다", () => {
    /*
     * 카드 하나로는 배정리스트 293곳과 성적산출 44곳이 한 덩어리로 보여, 어느
     * 시트를 손봐야 하는지 화면에서 읽을 수 없었다(사용자 요구 2026-09-22).
     *
     * 처음엔 카드 **아래** 따로 표를 뒀는데, 사용자가 운영리포트 `계약 체결` 카드를
     * 가리키며 카드 **안에서** 나누라고 했다(2026-09-23) — 같은 숫자를 두 군데서
     * 말하지도 않는다.
     */
    render(<WorkloadTable {...props()} />);

    const univ = screen.getByRole("group", { name: "담당 대학" });
    expect(within(univ).getByText("293")).toBeInTheDocument();
    expect(within(univ).getByText("02. 배정리스트")).toBeInTheDocument();

    const svc = screen.getByRole("group", { name: "서비스 물량" });
    expect(within(svc).getByText("568")).toBeInTheDocument();
  });

  it("칸의 합이 카드 머리보다 큰 이유를 적는다", () => {
    /*
     * 293+49+81+44 = 467 인데 머리는 286 이다. 한 대학이 여러 시트에 걸려 있어서고,
     * 안 적으면 다음 사람이 둘 중 하나를 버그로 보고 '고친다'.
     */
    render(<WorkloadTable {...props()} />);

    expect(screen.getByText(/여러 시트/)).toBeInTheDocument();
  });

  it("현재 학년도는 서비스마감이 원천이라고 적는다", () => {
    render(<WorkloadTable {...props()} />);
    expect(screen.getByText(/서비스마감/)).toBeInTheDocument();
  });

  /**
   * **담당자는 두 해 모두 원장이다**(#1215). 그 전에는 과거 학년도만
   * `services.operator_email` 을 봤고 이 문구가 "담당자도 그쪽 기록입니다" 였다 —
   * 원천이 바뀐 뒤에도 남아 있어 화면이 자기 원천을 잘못 말하고 있었다.
   */
  it("과거 학년도도 담당자는 원장이라고 적는다", () => {
    render(<WorkloadTable {...props()} academicYear={2026} isPast />);

    const note = screen.getByText(/서비스목록/);
    expect(note.textContent).toMatch(/배정 원장/);
    expect(note.textContent).not.toMatch(/담당자도 그쪽/);
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
    {
      group: "2",
      target: { universities: 20, density: 4 },
      rows: [row({ running })],
    },
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
    expect(
      screen.getByText(/이번 달에 도는 서비스가 없습니다/),
    ).toBeInTheDocument();
  });
});
