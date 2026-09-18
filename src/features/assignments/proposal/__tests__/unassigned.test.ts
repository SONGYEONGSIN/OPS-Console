import { describe, it, expect } from "vitest";
import {
  findUnassignedKeys,
  unlinkedCount,
  SWEEP_MAX_ENQUEUE,
  type UnassignedLedgerCell,
} from "../unassigned";

/**
 * 미배정 감지 — 평일 잡이 무엇을 요청으로 만드는가(설계 §6.4).
 *
 * **미배정과 '연결 안 됨' 은 다르다**(F2). 주소가 안 붙은 칸에 이름이 남아 있으면
 * 사람이 배정은 했고 주소만 못 이은 것이다 — 그걸 판정으로 보내면 에이전트가 이미
 * 담당자가 있는 칸에 남을 앉힌다.
 */
const cell = (
  university_name: string,
  work_kind: string,
  assignee_email: string | null,
  extra: Partial<UnassignedLedgerCell> = {},
): UnassignedLedgerCell => ({
  university_name,
  work_kind,
  role: "운영",
  assignee_email,
  assignee_name: "",
  ...extra,
});

describe("findUnassignedKeys", () => {
  it("주소도 이름도 없는 운영 칸을 미배정으로 센다", () => {
    const keys = findUnassignedKeys([cell("가대", "원서접수", null)]);
    expect(keys).toEqual([{ university_name: "가대", work_kind: "원서접수" }]);
  });

  it("담당자가 있으면 미배정이 아니다", () => {
    expect(findUnassignedKeys([cell("가대", "원서접수", "a@x.com")])).toEqual(
      [],
    );
  });

  it("이름은 있고 주소만 없으면 미배정이 아니다 — '연결 안 됨' 이다", () => {
    // 그 칸에는 사람이 적어 둔 담당자가 있다. 고칠 것은 주소이고 배정이 아니다(F2).
    const keys = findUnassignedKeys([
      cell("가대", "원서접수", null, { assignee_name: "김운영" }),
    ]);
    expect(keys).toEqual([]);
  });

  it("하위유형 하나라도 담당자가 있으면 미배정이 아니다 — 가려 옮기면 분할이다", () => {
    // 단위가 (대학 × 업무종류)다(rev 4). 수시만 비었다고 요청하면 에이전트가
    // 정시 담당자와 다른 사람을 앉혀 그 대학이 갈린다.
    const keys = findUnassignedKeys([
      cell("가대", "원서접수", "a@x.com"),
      cell("가대", "원서접수", null),
    ]);
    expect(keys).toEqual([]);
  });

  it("상담앱은 요청하지 않는다 — 자동 배정 대상이 아니다", () => {
    // 매 평일 요청이 쌓이고 판정은 매번 '대상 아님' 으로 끝난다.
    expect(findUnassignedKeys([cell("가대", "상담앱", null)])).toEqual([]);
  });

  it("개발 칸은 보지 않는다 — operators 밖이라 배정 대상이 될 수 없다", () => {
    const keys = findUnassignedKeys([
      cell("가대", "원서접수", null, { role: "개발" }),
    ]);
    expect(keys).toEqual([]);
  });

  it("같은 키가 여러 하위유형으로 와도 한 건이다", () => {
    const keys = findUnassignedKeys([
      cell("가대", "원서접수", null),
      cell("가대", "원서접수", null),
    ]);
    expect(keys).toHaveLength(1);
  });

  it("대학명·업무종류 순으로 정렬한다 — 상한에 걸릴 때 매번 같은 것부터 본다", () => {
    const keys = findUnassignedKeys([
      cell("나대", "원서접수", null),
      cell("가대", "대학원", null),
      cell("가대", "원서접수", null),
    ]);
    expect(keys.map((k) => `${k.university_name}|${k.work_kind}`)).toEqual([
      "가대|대학원",
      "가대|원서접수",
      "나대|원서접수",
    ]);
  });
});

describe("unlinkedCount", () => {
  it("이름만 있는 칸을 센다 — 사람이 고칠 것이 있다는 신호다", () => {
    const n = unlinkedCount([
      cell("가대", "원서접수", null, { assignee_name: "김운영" }),
      cell("나대", "원서접수", null),
      cell("다대", "원서접수", "a@x.com"),
    ]);
    expect(n).toBe(1);
  });

  it("같은 키의 하위유형 둘이 이름만 있으면 한 건이다", () => {
    const n = unlinkedCount([
      cell("가대", "원서접수", null, { assignee_name: "김" }),
      cell("가대", "원서접수", null, { assignee_name: "김" }),
    ]);
    expect(n).toBe(1);
  });
});

describe("SWEEP_MAX_ENQUEUE", () => {
  it("한 번에 적재할 수 있는 요청 수에 상한이 있다", () => {
    // 이관이 실패해 원장이 통째로 비면 300건이 큐에 쌓인다 — 폴러가 5분에 1건씩
    // 가져가므로 큐가 며칠 잠긴다.
    expect(SWEEP_MAX_ENQUEUE).toBeGreaterThan(0);
    expect(SWEEP_MAX_ENQUEUE).toBeLessThanOrEqual(20);
  });
});
