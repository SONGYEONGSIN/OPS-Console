import { describe, it, expect } from "vitest";
import { findNewcomers, sheetOfWorkKind } from "../newcomers";

/**
 * 신규배정 — **주인 없는 서비스만 골라낸다.**
 *
 * 실측(2026-09-21)이 규칙을 정했다. 2027학년도 원장의 미배정은 **0곳**이라
 * 원장만 보면 빈 탭이고, 마감 미러에만 있고 원장에 없는 키는 **26개**인데 그중
 * 16개가 `충남대학교 대학원` ↔ `충남대학교` 같은 **이름 변형**이다. 그걸 그대로
 * 올리면 매일 같은 26줄이 뜨는 '늘 켜진 경고등' 이 된다.
 *
 * **아직 시작 전**으로 거르면 26 → 1 이다. 이미 접수가 도는 대학은 누군가 보고
 * 있고 표기만 갈린 것이라, 배정할 것이 아니라 이름을 맞출 것이다.
 */

const cell = (
  university_name: string,
  work_kind: string,
  o: {
    assignee_email?: string | null;
    assignee_name?: string;
    role?: string;
    subtype?: string;
  } = {},
) => ({
  university_name,
  work_kind,
  subtype: o.subtype ?? "수시",
  role: o.role ?? "운영",
  assignee_email: o.assignee_email ?? null,
  assignee_name: o.assignee_name ?? "",
});

const span = (
  university_name: string,
  work_kind: string,
  start: string,
  end: string,
  service_name = "서비스",
) => ({ university_name, service_name, work_kind, start, end });

const TODAY = "2026-09-21";

describe("findNewcomers", () => {
  it("이름도 주소도 없는 원장 칸은 배정 요청 줄이 된다", () => {
    const rows = findNewcomers({
      ledger: [cell("가대", "원서접수")],
      spans: [],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      university_name: "가대",
      work_kind: "원서접수",
      source: "ledger-unassigned",
      canRequest: true,
    });
  });

  it("이름은 있고 주소가 없으면 요청을 만들지 않는다 — 고칠 것은 주소다", () => {
    /*
     * 사람은 배정을 했고 주소만 못 이었다. 여기에 요청을 만들면 에이전트가 이미
     * 담당자가 있는 칸에 남을 앉히고, 관리자는 왜 담당자가 둘인지 설명할 수 없다.
     */
    const rows = findNewcomers({
      ledger: [cell("나대", "원서접수", { assignee_name: "담당자" })],
      spans: [],
      today: TODAY,
    });

    expect(rows[0]).toMatchObject({
      source: "ledger-unlinked",
      canRequest: false,
      assigneeName: "담당자",
    });
  });

  it("원장에 없고 아직 시작 전인 서비스는 줄이 된다", () => {
    const rows = findNewcomers({
      ledger: [cell("가대", "원서접수", { assignee_email: "a@x.com" })],
      spans: [
        span("새대", "원서접수", "2026-10-01", "2026-10-05", "2027 수시"),
      ],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      university_name: "새대",
      source: "not-in-ledger",
      start: "2026-10-01",
      services: ["2027 수시"],
      canRequest: true,
    });
  });

  it("원장에 없어도 이미 시작했으면 줄이 아니다 — 이름 변형이 26개다", () => {
    const rows = findNewcomers({
      ledger: [cell("충남대학교", "대학원", { assignee_email: "a@x.com" })],
      spans: [span("충남대학교 대학원", "대학원", "2026-09-01", "2026-09-30")],
      today: TODAY,
    });

    expect(rows).toEqual([]);
  });

  it("오늘 시작하는 것은 이미 시작한 것이다", () => {
    const rows = findNewcomers({
      ledger: [],
      spans: [span("새대", "원서접수", TODAY, "2026-10-05")],
      today: TODAY,
    });

    expect(rows).toEqual([]);
  });

  it("원장 미배정은 이미 시작했어도 남는다 — 그건 노이즈가 아니라 사고다", () => {
    /*
     * 시작 전 필터는 **원장에 없는 키에만** 건다. 원장에 칸이 있는데 비었다는 것은
     * 표기 갈림이 아니라 아무도 안 보고 있는 접수라, 이미 열렸으면 더 급하다.
     */
    const rows = findNewcomers({
      ledger: [cell("가대", "원서접수")],
      spans: [span("가대", "원서접수", "2026-09-01", "2026-09-30", "수시")],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "ledger-unassigned",
      start: "2026-09-01",
      services: ["수시"],
    });
  });

  it("같은 키의 서비스는 한 줄로 묶고 가장 이른 시작을 적는다", () => {
    const rows = findNewcomers({
      ledger: [],
      spans: [
        span("새대", "원서접수", "2026-11-01", "2026-11-05", "정시"),
        span("새대", "원서접수", "2026-10-01", "2026-10-05", "수시"),
      ],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      start: "2026-10-01",
      services: ["수시", "정시"],
    });
  });

  it("상담앱은 배정 대상이 아니라 줄이 되지 않는다", () => {
    const rows = findNewcomers({
      ledger: [cell("가대", "상담앱")],
      spans: [],
      today: TODAY,
    });

    expect(rows).toEqual([]);
  });

  it("개발 칸은 배정 대상이 아니다 — `operators` 밖이라 앉힐 사람이 없다", () => {
    const rows = findNewcomers({
      ledger: [cell("가대", "원서접수", { role: "개발" })],
      spans: [],
      today: TODAY,
    });

    expect(rows).toEqual([]);
  });

  it("시작이 이른 것부터, 모르는 것은 뒤로 — 급한 순서가 화면 순서다", () => {
    const rows = findNewcomers({
      ledger: [cell("모름대", "원서접수"), cell("늦대", "원서접수")],
      spans: [
        span("늦대", "원서접수", "2026-12-01", "2026-12-05"),
        span("빠른대", "원서접수", "2026-10-01", "2026-10-05"),
      ],
      today: TODAY,
    });

    expect(rows.map((r) => r.university_name)).toEqual([
      "빠른대",
      "늦대",
      "모름대",
    ]);
  });
});

describe("findNewcomers — 비슷한 이름", () => {
  /**
   * **잇지 않는다, 보여 준다.** 원장에 없는 26개 중 23개가 이름 변형이고
   * (실측 2026-09-21) 앞 4자가 갈림을 가른다 — 2·3자짜리는 하나도 없어서
   * 분포에 빈 구간이 있다. 그래도 **줄은 남긴다**: 거르면 진짜 새 캠퍼스가
   * 조용히 사라지고, 사라진 것은 아무도 못 찾는다.
   */
  it("앞 4자가 같은 원장 대학을 나란히 적는다", () => {
    const rows = findNewcomers({
      ledger: [
        cell("청심국제중학교", "원서접수", { assignee_email: "a@x.com" }),
        cell("청심국제고등학교", "원서접수", { assignee_email: "a@x.com" }),
      ],
      spans: [
        span("청심국제중고등학교", "원서접수", "2026-10-22", "2026-10-25"),
      ],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].similarNames).toEqual([
      "청심국제고등학교",
      "청심국제중학교",
    ]);
  });

  it("3자까지만 같으면 적지 않는다 — 경계는 실측이 정했다", () => {
    const rows = findNewcomers({
      ledger: [
        cell("진주보건대학교", "원서접수", { assignee_email: "a@x.com" }),
      ],
      spans: [span("진학대학교", "원서접수", "2026-10-22", "2026-10-25")],
      today: TODAY,
    });

    expect(rows[0].similarNames).toEqual([]);
  });

  it("다른 업무종류의 이름은 보지 않는다", () => {
    const rows = findNewcomers({
      ledger: [cell("충남대학교", "원서접수", { assignee_email: "a@x.com" })],
      spans: [span("충남대학교 대학원", "대학원", "2026-10-22", "2026-10-25")],
      today: TODAY,
    });

    expect(rows[0].similarNames).toEqual([]);
  });

  it("비슷한 이름이 있어도 줄은 남는다 — 거르면 진짜 새것이 사라진다", () => {
    const rows = findNewcomers({
      ledger: [cell("서울대학교", "원서접수", { assignee_email: "a@x.com" })],
      spans: [
        span("서울대학교 시흥캠퍼스", "원서접수", "2026-10-22", "2026-10-25"),
      ],
      today: TODAY,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].similarNames).toEqual(["서울대학교"]);
  });

  it("원장에서 온 줄에는 붙이지 않는다 — 그 대학은 원장에 이미 있다", () => {
    const rows = findNewcomers({
      ledger: [cell("가대", "원서접수")],
      spans: [],
      today: TODAY,
    });

    expect(rows[0].similarNames).toBeUndefined();
  });
});

describe("sheetOfWorkKind", () => {
  it("업무종류가 시트를 정한다 — 서비스가 중간에 들어오면 어디에 적을지가 첫 물음이다", () => {
    expect(sheetOfWorkKind("원서접수")).toBe("02. 배정리스트");
    expect(sheetOfWorkKind("대학원")).toBe("03. 대학원");
    expect(sheetOfWorkKind("PIMS")).toBe("04. PIMS");
    expect(sheetOfWorkKind("성적산출")).toBe("06. 성적산출");
  });
});
