import { describe, it, expect } from "vitest";
import { badgesOf, type BadgeCell } from "../badges";

/**
 * 배지는 **원장 한 칸 묶음**(대학 하나의 업무종류 하나)에 대한 판정이다.
 * 설계 §9.2 가 `미배정`·`연결 안 됨`·`분할` 셋을 요구한다.
 *
 * 화면에 인라인으로 쓰지 않고 순수 함수로 두는 이유는 **PR6 의 게이트(G4 — 분할
 * 44곳을 자동 이동에서 뺀다)가 같은 판정을 써야** 하기 때문이다. 두 벌로 두면
 * 화면이 '분할' 이라 표시한 대학을 게이트는 아니라고 보는 일이 생긴다.
 */
const cell = (o: Partial<BadgeCell> = {}): BadgeCell => ({
  role: "운영",
  assignee_email: "a@x.com",
  assignee_name: "가운영",
  ...o,
});

describe("badgesOf", () => {
  it("정상 칸에는 배지가 없다", () => {
    expect(badgesOf([cell()])).toEqual([]);
  });

  it("칸이 아예 없으면 미배정이다", () => {
    expect(badgesOf([])).toEqual(["미배정"]);
  });

  it("이름이 전부 빈 값이면 미배정이다 — 빈 이름은 배정이 아니다", () => {
    expect(
      badgesOf([cell({ assignee_name: "  ", assignee_email: null })]),
    ).toEqual(["미배정"]);
  });

  it("운영 칸에 이름은 있는데 이메일이 없으면 연결 안 됨이다", () => {
    expect(
      badgesOf([cell({ assignee_email: null, assignee_name: "김없음" })]),
    ).toEqual(["연결 안 됨"]);
  });

  /**
   * 라이브 실측(2026-09-15): 개발 칸 890개의 이메일 매칭이 **전부 0** 이다.
   * `operators` 는 운영부 명단이고 `team` check 가 `운영1팀·운영2팀` 이라 개발부가
   * 들어갈 자리가 없다. 사용자 확인 — 이 원장은 운영자 배정을 위한 것이고 개발 칸에
   * 이메일이 없는 것은 **정상이다.** 여기에 배지를 붙이면 890칸이 전부 빨개진다.
   */
  it("개발 칸은 이메일이 없어도 연결 안 됨이 아니다", () => {
    expect(
      badgesOf([
        cell(),
        cell({ role: "개발", assignee_email: null, assignee_name: "나개발" }),
      ]),
    ).toEqual([]);
  });

  it("운영 담당자가 둘이면 분할이다", () => {
    expect(
      badgesOf([
        cell({ assignee_email: "a@x.com", assignee_name: "가운영" }),
        cell({ assignee_email: "b@x.com", assignee_name: "나운영" }),
      ]),
    ).toEqual(["분할"]);
  });

  it("한 사람이 하위유형 둘을 맡은 것은 분할이 아니다", () => {
    expect(badgesOf([cell(), cell()])).toEqual([]);
  });

  /**
   * 분할 판정의 단위는 **이메일이 아니라 사람**이다. 이메일이 없는 칸까지 이메일로
   * 세면 미매칭 둘이 같은 사람이어도 분할로 보인다 — 이름으로 센다.
   */
  it("운영·개발이 서로 다른 사람인 것은 분할이 아니다 — 역할이 다르다", () => {
    expect(
      badgesOf([cell(), cell({ role: "개발", assignee_name: "나개발" })]),
    ).toEqual([]);
  });

  it("연결 안 됨과 분할은 함께 붙는다", () => {
    expect(
      badgesOf([
        cell({ assignee_email: "a@x.com", assignee_name: "가운영" }),
        cell({ assignee_email: null, assignee_name: "김없음" }),
      ]),
    ).toEqual(["연결 안 됨", "분할"]);
  });

  it("빈 이름 칸은 분할로 세지 않는다 — 없는 배정을 담당자로 세지 않는다", () => {
    expect(
      badgesOf([cell(), cell({ assignee_name: "", assignee_email: null })]),
    ).toEqual([]);
  });
});
