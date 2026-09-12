import { describe, it, expect } from "vitest";
import {
  ASSIGNMENT_CHANGE_SOURCES,
  ASSIGNMENT_NATURAL_KEY,
  ASSIGNMENT_ROLES,
  ASSIGNMENT_WORK_KINDS,
  assignmentNaturalKeySchema,
} from "../ledger-schemas";
import { SERVICE_KINDS } from "../schemas";

/**
 * 배정 원장의 어휘와 자연키.
 *
 * 자연키가 다섯 칸인 이유와 `subtype` 이 빈 문자열인 이유가 한 몸이다 —
 * Postgres 의 unique 는 null 을 서로 다른 값으로 보므로, `subtype` 이 null 이면
 * 같은 배정이 몇 번이고 들어간다. 그래서 DB 는 `not null default ''` 이고
 * zod 도 같은 규칙을 지켜야 한다. 여기서 그 한 쌍을 못 박는다.
 */
describe("배정 자연키 — subtype 은 빈 문자열이고 null 이 아니다", () => {
  const base = {
    academic_year: 2027,
    university_name: "국립군산대학교",
    work_kind: "원서접수" as const,
    role: "운영" as const,
  };

  it("subtype 빈 문자열을 통과시킨다 — 하위유형이 없는 업무가 그렇다", () => {
    const parsed = assignmentNaturalKeySchema.safeParse({
      ...base,
      subtype: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("subtype null 을 거부한다 — null 이면 자연키가 중복을 못 막는다", () => {
    const parsed = assignmentNaturalKeySchema.safeParse({
      ...base,
      subtype: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("subtype 누락을 거부한다 — 빈 문자열은 생략이 아니라 선택이다", () => {
    const parsed = assignmentNaturalKeySchema.safeParse(base);
    expect(parsed.success).toBe(false);
  });

  /**
   * `''` 와 `' '` 도 Postgres unique 에는 서로 다른 값이다. null 만 막고 공백을
   * 열어 두면 자연키가 갈린다 — PR3 이 엑셀 셀을 읽어 넣고, 공백은 거기서 온다.
   * 바로 위 `university_name` 이 이미 다듬으므로 이 비대칭은 누락이었다.
   */
  it("subtype 의 앞뒤 공백을 지운다 — ' ' 는 '' 와 같은 칸이다", () => {
    const parsed = assignmentNaturalKeySchema.safeParse({
      ...base,
      subtype: " ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.subtype).toBe("");
  });

  it("'  수시 ' 와 '수시' 가 같은 자연키가 된다", () => {
    const padded = assignmentNaturalKeySchema.parse({
      ...base,
      subtype: "  수시 ",
    });
    const plain = assignmentNaturalKeySchema.parse({
      ...base,
      subtype: "수시",
    });
    expect(padded.subtype).toBe(plain.subtype);
  });

  it("하위유형이 있는 업무도 그대로 통과한다", () => {
    expect(
      assignmentNaturalKeySchema.safeParse({ ...base, subtype: "수시" })
        .success,
    ).toBe(true);
  });

  it("대학명이 비면 거부한다 — 공백만 있는 칸도 마찬가지다", () => {
    for (const university_name of ["", "   "]) {
      const parsed = assignmentNaturalKeySchema.safeParse({
        ...base,
        university_name,
        subtype: "",
      });
      expect(parsed.success, JSON.stringify(university_name)).toBe(false);
    }
  });

  it("학년도는 정수다 — 문자열·소수를 거부한다", () => {
    for (const academic_year of ["2027", 2027.5]) {
      const parsed = assignmentNaturalKeySchema.safeParse({
        ...base,
        academic_year,
        subtype: "",
      });
      expect(parsed.success, String(academic_year)).toBe(false);
    }
  });
});

describe("role — 정의상 둘뿐이다", () => {
  const base = {
    academic_year: 2027,
    university_name: "국립군산대학교",
    work_kind: "원서접수" as const,
    subtype: "수시",
  };

  it("운영·개발을 통과시킨다", () => {
    for (const role of ASSIGNMENT_ROLES) {
      expect(
        assignmentNaturalKeySchema.safeParse({ ...base, role }).success,
        role,
      ).toBe(true);
    }
  });

  it("그 밖의 값을 거부한다", () => {
    for (const role of ["기획", "운영자", "", "OPS"]) {
      expect(
        assignmentNaturalKeySchema.safeParse({ ...base, role }).success,
        role,
      ).toBe(false);
    }
  });

  it("두 값이고 순서가 운영·개발이다", () => {
    expect([...ASSIGNMENT_ROLES]).toEqual(["운영", "개발"]);
  });
});

/**
 * 업무종류는 **두 번째 어휘를 만들지 않는다.** 대학배정 탭이 쓰는 `SERVICE_KINDS`
 * 가 이미 다섯 값을 갖고 있고, 원장이 그것과 다른 목록을 들면 같은 업무가 화면과
 * 원장에서 다른 이름을 갖는다. 팀 값이 네 곳에 흩어져 한 사람이 조용히 사라진
 * 적이 있다 — 그때와 같은 종류의 사고다.
 */
describe("업무종류 어휘 — SERVICE_KINDS 하나에서 나온다", () => {
  it("ASSIGNMENT_WORK_KINDS 가 SERVICE_KINDS 와 같은 집합이다", () => {
    expect([...ASSIGNMENT_WORK_KINDS].sort()).toEqual(
      [...SERVICE_KINDS].sort(),
    );
  });

  it("zod 가 다섯 값을 통과시킨다", () => {
    for (const work_kind of SERVICE_KINDS) {
      const parsed = assignmentNaturalKeySchema.safeParse({
        academic_year: 2027,
        university_name: "국립군산대학교",
        work_kind,
        subtype: "",
        role: "운영",
      });
      expect(parsed.success, work_kind).toBe(true);
    }
  });

  it("모르는 업무종류를 거부한다", () => {
    const parsed = assignmentNaturalKeySchema.safeParse({
      academic_year: 2027,
      university_name: "국립군산대학교",
      work_kind: "모의논술",
      subtype: "",
      role: "운영",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("자연키 컬럼 목록 — 순서가 곧 unique 인덱스다", () => {
  it("다섯 칸이고 순서가 정해져 있다", () => {
    expect([...ASSIGNMENT_NATURAL_KEY]).toEqual([
      "academic_year",
      "university_name",
      "work_kind",
      "subtype",
      "role",
    ]);
  });

  it("zod 가 받는 칸과 자연키 칸이 같다", () => {
    expect(Object.keys(assignmentNaturalKeySchema.shape).sort()).toEqual(
      [...ASSIGNMENT_NATURAL_KEY].sort(),
    );
  });
});

describe("이력 source 어휘", () => {
  it("넷이다 — import·manual·proposal·revert", () => {
    expect([...ASSIGNMENT_CHANGE_SOURCES].sort()).toEqual(
      ["import", "manual", "proposal", "revert"].sort(),
    );
  });
});
