import { describe, it, expect } from "vitest";
import {
  workKindOfClosing,
  buildServiceCounts,
  buildSpans,
  workloadWindows,
} from "../workload-sources";

/**
 * 건수 원천 → `대학|업무종류` 키. **설계 §6.2 를 실측으로 고쳐 쓴 자리**다.
 *
 * §6.2 는 원서접수 건수를 `services` 에서 센다고 적었는데, 그 표는 구글 시트
 * 임포트가 **2026-02-28 에서 멈춰 있다**(2511행 전부 `google_sheet_import`,
 * `write_start_at` 최대 2026-02-28). 지금 학년도 창으로 자르면 0건이라 전원의
 * 건수·밀도·주월연이 통째로 0 이 된다. 살아 있는 미러는 `closing_services`
 * 하나이고(창 안 969건/286곳 — §6.2 가 적은 286곳과 같다), 대학원은 그 안에
 * `category` 로 들어 있다. 그래서 **원천은 하나, 가르는 것은 category** 다.
 */
const cs = (
  university_name: string,
  category: string | null,
  start = "2026-09-01T00:00:00+09:00",
  end = "2026-09-10T23:59:00+09:00",
) => ({
  university_name,
  category,
  write_start_at: start,
  write_end_at: end,
});

describe("workKindOfClosing", () => {
  it("대학원이 들어간 구분은 전부 대학원이다", () => {
    // 실측 구분 넷: 대학원 후기 260 · 대학원 89 · 대학원 전기 42 · 법학전문대학원 5.
    // 목록으로 적으면 새 구분이 생기는 날 조용히 원서접수로 세어진다.
    for (const c of [
      "대학원",
      "대학원 전기",
      "대학원 후기",
      "법학전문대학원 가나",
      "법학전문대학원 나군",
    ]) {
      expect(workKindOfClosing(c)).toBe("대학원");
    }
  });

  it("나머지는 원서접수다", () => {
    for (const c of ["수시", "정시", "외국인", "편입학", "대학부설기관"]) {
      expect(workKindOfClosing(c)).toBe("원서접수");
    }
  });

  it("구분이 비어도 원서접수로 센다 — 어디에도 안 세는 것보다 낫다", () => {
    expect(workKindOfClosing(null)).toBe("원서접수");
  });
});

describe("buildServiceCounts", () => {
  it("대학과 업무종류로 갈라 센다", () => {
    const counts = buildServiceCounts({
      closing: [cs("가대", "수시"), cs("가대", "정시"), cs("가대", "대학원")],
      announcement: [],
    });

    expect(counts).toEqual({ "가대|원서접수": 2, "가대|대학원": 1 });
  });

  it("발표 원천은 PIMS 로 붙는다", () => {
    const counts = buildServiceCounts({
      closing: [],
      announcement: [{ university_name: "가대" }, { university_name: "가대" }],
    });

    expect(counts).toEqual({ "가대|PIMS": 2 });
  });

  it("성적산출·상담앱 키는 만들지 않는다 — 원천이 없다", () => {
    // 키가 없어야 `buildWorkload` 가 '못 센 칸' 으로 센다. 0 을 넣어 두면
    // '일이 없다' 로 읽혀 44곳·25곳이 조용히 부하 0 이 된다.
    const counts = buildServiceCounts({
      closing: [cs("가대", "수시")],
      announcement: [],
    });

    expect(Object.keys(counts)).toEqual(["가대|원서접수"]);
  });

  it("빈 원천은 빈 맵이다", () => {
    expect(buildServiceCounts({ closing: [], announcement: [] })).toEqual({});
  });
});

describe("buildSpans", () => {
  it("구간에 업무종류를 달아 준다", () => {
    expect(buildSpans([cs("가대", "대학원")])).toEqual([
      {
        university_name: "가대",
        work_kind: "대학원",
        start: "2026-09-01",
        end: "2026-09-10",
      },
    ]);
  });

  it("KST 로 자른다 — UTC 문자열을 그대로 자르면 하루가 밀린다", () => {
    // 2026-09-14T15:00Z 는 KST 로 9월 15일 자정이다. ISO 문자열을 slice 하면
    // 9월 14일이 되어, 주 경계에 걸린 접수가 엉뚱한 주에 잡힌다.
    const [span] = buildSpans([
      cs("가대", "수시", "2026-09-14T15:00:00Z", "2026-09-20T14:59:00Z"),
    ]);

    expect(span).toMatchObject({ start: "2026-09-15", end: "2026-09-20" });
  });
});

/**
 * 주·월·연 창. **연은 `academicYearRangeKST` 가 정한다** — 여기서 다시 정의하면
 * 마감 스크랩과 배분현황이 서로 다른 해를 보면서 둘 다 '올해' 라고 적는다.
 *
 * 주는 **월요일 시작**이다. 접수 오픈이 월요일에 몰려서, 일요일 시작으로 두면
 * 같은 주의 오픈이 두 주로 갈린다.
 */
describe("workloadWindows", () => {
  const NOW = new Date("2026-09-17T12:00:00+09:00"); // 목요일

  it("주는 월요일부터 일요일까지다", () => {
    expect(workloadWindows(NOW).week).toEqual(["2026-09-14", "2026-09-20"]);
  });

  it("월요일 자정 직후도 그 주에 든다 — 앞주로 밀리지 않는다", () => {
    expect(
      workloadWindows(new Date("2026-09-14T00:05:00+09:00")).week,
    ).toEqual(["2026-09-14", "2026-09-20"]);
  });

  it("일요일은 그 주의 끝이다 — 다음 주로 넘어가지 않는다", () => {
    expect(
      workloadWindows(new Date("2026-09-20T23:50:00+09:00")).week,
    ).toEqual(["2026-09-14", "2026-09-20"]);
  });

  it("월은 1일부터 말일까지다", () => {
    expect(workloadWindows(NOW).month).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("KST 로 가른다 — UTC 자정은 한국에서 이미 다음 날이다", () => {
    // 2026-08-31T15:00Z 는 KST 9월 1일 자정이다. UTC 로 보면 8월이라 창이 통째로 밀린다.
    expect(
      workloadWindows(new Date("2026-08-31T15:00:00Z")).month,
    ).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("연은 학년도다 — 3/1 부터 익년 2월 말일까지", () => {
    expect(workloadWindows(NOW).year).toEqual(["2026-03-01", "2027-02-28"]);
  });
});
