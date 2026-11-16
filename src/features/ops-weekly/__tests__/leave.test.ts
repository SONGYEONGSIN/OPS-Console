import { describe, expect, it } from "vitest";
import {
  buildLeaveItems,
  type BackupLeaveLite,
  type ScheduleLeaveLite,
} from "../auto-lists/leave";

const args = {
  operatorEmail: "a@x",
  operatorName: "운영자A",
  weekStart: "2026-11-16",
};

function b(
  id: string,
  type: string | null,
  start: string | null,
  end: string | null,
  sub: string,
): BackupLeaveLite {
  return {
    id,
    leave_type: type,
    leave_start_date: start,
    leave_end_date: end,
    substitute_name: sub,
  };
}
function s(
  id: string,
  type: ScheduleLeaveLite["type"],
  title: string,
  start: string,
  end: string | null,
  email: string | null,
): ScheduleLeaveLite {
  return {
    id,
    type,
    title,
    start_at: start,
    end_at: end,
    assignee_email: email,
  };
}

describe("buildLeaveItems", () => {
  it("같은 휴가가 두 원천에 있으면 백업요청 한 줄로 합친다 — 종일 UTC 저장도", () => {
    const items = buildLeaveItems({
      ...args,
      backups: [b("b1", "연차", "2026-11-18", "2026-11-19", "백업자")],
      schedules: [
        s(
          "s1",
          "leave",
          "운영2팀-운영자A-연차",
          "2026-11-17T15:00:00Z",
          "2026-11-18T15:00:00Z",
          null,
        ),
      ],
    });
    expect(items).toEqual([
      expect.objectContaining({
        key: "leave:br:b1",
        sources: ["backup", "schedule"],
        substituteName: "백업자",
        needsBackup: false,
        title: "연차",
        subtitle: "백업 백업자",
        at: null,
      }),
    ]);
  });

  it("가족이 다르면 합치지 않는다 — 휴가와 외근", () => {
    const items = buildLeaveItems({
      ...args,
      backups: [b("b1", "연차", "2026-11-18", "2026-11-19", "백업자")],
      schedules: [
        s(
          "s2",
          "external_meeting",
          "외부미팅",
          "2026-11-19T05:00:00Z",
          null,
          "a@x",
        ),
      ],
    });
    expect(items.map((i) => i.key)).toEqual(["leave:br:b1", "leave:se:s2"]);
    expect(items[1]).toMatchObject({ family: "field", needsBackup: false });
  });

  it("일정에만 있는 휴가는 백업요청 만들기 대상", () => {
    const [it0] = buildLeaveItems({
      ...args,
      backups: [],
      schedules: [
        s("s3", "leave", "휴가", "2026-11-26T00:00:00Z", null, "a@x"),
      ],
    });
    expect(it0).toMatchObject({
      needsBackup: true,
      kindLabel: "휴가",
      startYmd: "2026-11-26",
      title: "휴가",
      subtitle: "백업 없음",
      at: null,
    });
  });

  it("여러 주에 걸친 휴가는 들고, 시작일 없는 백업요청과 남의 일정은 뺀다", () => {
    const items = buildLeaveItems({
      ...args,
      backups: [
        b("b2", "장기휴가", "2026-11-09", "2026-11-30", "백업자"),
        b("b3", "연차", null, null, "백업자"),
      ],
      schedules: [
        s(
          "s4",
          "leave",
          "운영1팀-운영자B-연차",
          "2026-11-18T00:00:00Z",
          null,
          null,
        ),
        s("s5", "leave", "휴가", "2026-11-18T00:00:00Z", null, "b@x"),
      ],
    });
    expect(items.map((i) => i.key)).toEqual(["leave:br:b2"]);
  });

  it("반차 날짜 하나짜리도 든다", () => {
    expect(
      buildLeaveItems({
        ...args,
        schedules: [],
        backups: [b("b4", "오후반차", "2026-11-24", null, "백업자")],
      })[0],
    ).toMatchObject({
      startYmd: "2026-11-24",
      endYmd: "2026-11-24",
      kindLabel: "오후반차",
    });
  });

  it("창 밖이면 뺀다 — 2주(월~일) 경계, 정렬은 시작일 순", () => {
    const items = buildLeaveItems({
      ...args,
      schedules: [],
      backups: [
        b("late", "연차", "2026-11-30", null, "백업자"),
        b("edge", "연차", "2026-11-29", null, "백업자"),
        b("early", "연차", "2026-11-16", null, "백업자"),
        b("past", "연차", "2026-11-13", "2026-11-15", "백업자"),
      ],
    });
    expect(items.map((i) => i.key)).toEqual([
      "leave:br:early",
      "leave:br:edge",
    ]);
  });

  it("가족 분류 — 외근·출장은 field, 교육은 training, 유형 없음은 휴가", () => {
    const items = buildLeaveItems({
      ...args,
      schedules: [],
      backups: [
        b("a", "외근", "2026-11-16", null, "백업자"),
        b("b", "출장", "2026-11-17", null, "백업자"),
        b("c", "교육", "2026-11-18", null, "백업자"),
        b("d", null, "2026-11-19", null, "백업자"),
      ],
    });
    expect(items.map((i) => [i.family, i.kindLabel])).toEqual([
      ["field", "외근"],
      ["field", "출장"],
      ["training", "교육"],
      ["leave", "휴가"],
    ]);
  });

  it("이름이 빈 값이면 제목 매칭으로 남의 일정을 끌어오지 않는다", () => {
    const items = buildLeaveItems({
      ...args,
      operatorName: "  ",
      backups: [],
      schedules: [
        s("s6", "leave", "누군가-연차", "2026-11-18T00:00:00Z", null, null),
      ],
    });
    expect(items).toEqual([]);
  });
});
