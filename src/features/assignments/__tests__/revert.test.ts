import { describe, it, expect } from "vitest";
import { latestPerCell, revertBlockedReason } from "../revert";
import type { AssignmentChange } from "../ledger-schemas";

/**
 * 되돌리기를 **누를 수 있는지**를 화면이 판정한다. 서버도 같은 판정을 하지만
 * (`revertChange`), 눌러 보고 나서야 "안 된다" 를 듣는 버튼은 고장으로 보인다.
 *
 * 막는 이유가 둘이다 — 그 뒤에 또 바뀌었거나, 되돌릴 주소가 명부에서 사라졌거나
 * (F14). 순서는 **또 바뀐 쪽이 먼저**다: 그건 사람이 손 쓸 수 있다(최신부터
 * 차례로 되돌린다). 주소가 사라진 것은 그 자리에서 할 수 있는 일이 없다.
 */
const change = (o: Partial<AssignmentChange> = {}): AssignmentChange => ({
  id: "c1",
  academic_year: 2027,
  university_name: "서울대학교",
  work_kind: "PIMS",
  subtype: "FULL",
  role: "운영",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  source: "manual",
  actor_email: "admin@x.com",
  changed_at: "2026-09-16T01:00:00.000Z",
  ...o,
});

const KNOWN = new Set(["a@x.com", "b@x.com"]);

describe("latestPerCell", () => {
  it("칸마다 가장 최근 한 줄을 고른다", () => {
    const old = change({ id: "old", changed_at: "2026-09-15T00:00:00.000Z" });
    const now = change({ id: "now", changed_at: "2026-09-16T00:00:00.000Z" });

    expect(latestPerCell([old, now])).toEqual(new Set(["now"]));
  });

  it("칸이 다르면 각자 최신이 있다", () => {
    const pims = change({ id: "pims" });
    const grad = change({ id: "grad", work_kind: "대학원", subtype: "" });

    expect(latestPerCell([pims, grad])).toEqual(new Set(["pims", "grad"]));
  });

  it("같은 대학 같은 업무라도 역할이 다르면 다른 칸이다", () => {
    const op = change({ id: "op", role: "운영" });
    const dev = change({ id: "dev", role: "개발" });

    expect(latestPerCell([op, dev])).toEqual(new Set(["op", "dev"]));
  });

  it("들어온 순서를 믿지 않는다 — changed_at 으로 고른다", () => {
    // 조회는 최신순으로 주지만, 그 정렬에 판정을 얹으면 조회 한 줄이 바뀔 때
    // 되돌리기 버튼이 엉뚱한 줄에 붙는다.
    const old = change({ id: "old", changed_at: "2026-09-15T00:00:00.000Z" });
    const now = change({ id: "now", changed_at: "2026-09-16T00:00:00.000Z" });

    expect(latestPerCell([old, now])).toEqual(latestPerCell([now, old]));
  });

  it("빈 목록은 빈 집합이다", () => {
    expect(latestPerCell([])).toEqual(new Set());
  });
});

describe("revertBlockedReason", () => {
  const opts = (latest: string[]) => ({
    latestIds: new Set(latest),
    knownEmails: KNOWN,
  });

  it("최신이고 주소가 살아 있으면 막지 않는다", () => {
    expect(revertBlockedReason(change(), opts(["c1"]))).toBeNull();
  });

  it("그 칸의 최신이 아니면 막는다", () => {
    const reason = revertBlockedReason(change(), opts(["다른줄"]));
    expect(reason).toMatch(/또 바뀌/);
  });

  it("되돌릴 주소가 명부에 없으면 막는다 — F14", () => {
    const reason = revertBlockedReason(
      change({ prev_assignee: "사라진@x.com" }),
      opts(["c1"]),
    );
    expect(reason).toMatch(/명부/);
  });

  it("빈 칸으로 되돌리는 것은 명부를 보지 않는다", () => {
    // 이관 이력 966줄이 전부 prev=null 이다. 되돌리면 칸이 빈다.
    expect(
      revertBlockedReason(change({ prev_assignee: null }), opts(["c1"])),
    ).toBeNull();
  });

  it("둘 다 걸리면 '또 바뀌었다' 를 먼저 말한다 — 그쪽은 손 쓸 수 있다", () => {
    const reason = revertBlockedReason(
      change({ prev_assignee: "사라진@x.com" }),
      opts(["다른줄"]),
    );
    expect(reason).toMatch(/또 바뀌/);
  });
});
