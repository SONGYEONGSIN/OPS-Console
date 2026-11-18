import { describe, expect, it } from "vitest";
import type { AutoItem } from "../auto-lists/application";
import {
  buildPimsGroups,
  countUnmatchedPims,
  listUnmatchedPims,
  type PimsLite,
} from "../auto-lists/pims";

function p(id: number, operator: string | null, at: string | null): PimsLite {
  return {
    service_id: id,
    university_name: `대학${id}`,
    service_name: `서비스${id}`,
    operator_name: operator,
    last_announce_at: at,
  };
}
const keys = (items: AutoItem[]) => items.map((i) => i.key);

describe("buildPimsGroups", () => {
  it("발표일 KST 로 금주/차주를 가른다", () => {
    const g = buildPimsGroups({
      weekStart: "2026-11-16",
      operatorName: "운영자A",
      rows: [
        p(1, "운영자A", "2026-11-20T01:00:00Z"),
        p(2, "운영자A", "2026-11-15T15:30:00Z"),
        p(3, "운영자A", "2026-11-27T01:00:00Z"),
        p(4, "운영자A", "2026-11-29T15:30:00Z"),
        p(5, "운영자A", null),
      ],
    });
    expect(keys(g.thisWeek)).toEqual(["pims:2", "pims:1"]);
    expect(keys(g.nextWeek)).toEqual(["pims:3"]);
  });

  it("남의 담당은 빼고 앞뒤 공백은 같은 사람으로 본다", () => {
    const g = buildPimsGroups({
      weekStart: "2026-11-16",
      operatorName: "운영자A",
      rows: [
        p(1, "운영자A ", "2026-11-20T01:00:00Z"),
        p(2, "운영자B", "2026-11-20T01:00:00Z"),
        p(3, null, "2026-11-20T01:00:00Z"),
      ],
    });
    expect(keys(g.thisWeek)).toEqual(["pims:1"]);
  });
});

describe("countUnmatchedPims", () => {
  it("안 붙음 — 창 안의 null·명단 밖만 센다", () => {
    expect(
      countUnmatchedPims({
        weekStart: "2026-11-16",
        writerNames: new Set(["운영자A"]),
        rows: [
          p(1, null, "2026-11-20T01:00:00Z"),
          p(2, "누군가", "2026-11-27T01:00:00Z"),
          p(3, null, "2026-12-20T01:00:00Z"),
        ],
      }),
    ).toBe(2);
  });

  it("공백뿐인 이름·앞뒤 공백 이름·발표일 없는 행", () => {
    expect(
      countUnmatchedPims({
        weekStart: "2026-11-16",
        writerNames: new Set(["운영자A"]),
        rows: [
          p(1, "   ", "2026-11-20T01:00:00Z"),
          p(2, " 운영자A ", "2026-11-20T01:00:00Z"),
          p(3, null, null),
        ],
      }),
    ).toBe(1);
  });
});

describe("listUnmatchedPims", () => {
  it("목록의 길이가 곧 개수다", () => {
    const args = {
      weekStart: "2026-11-16",
      writerNames: new Set(["운영자A"]),
      rows: [
        p(1, null, "2026-11-20T01:00:00Z"),
        p(2, "누군가", "2026-11-27T01:00:00Z"),
        p(3, "운영자A", "2026-11-20T01:00:00Z"),
        p(4, null, "2026-12-20T01:00:00Z"),
      ],
    };
    const list = listUnmatchedPims(args);
    expect(list.map((r) => r.service_id)).toEqual([1, 2]);
    expect(list.length).toBe(countUnmatchedPims(args));
  });
});
