import { describe, it, expect } from "vitest";
import {
  CLOSING_DIFF_FIELDS,
  closingComparableSchema,
  diffClosingRow,
  type ClosingComparable,
} from "../diff-row";
import type { ClosingIngestRow } from "../schemas";

/**
 * 두 fixture 는 **같은 서비스의 같은 상태**다 — 하나도 바뀌지 않았다.
 *
 * 다만 표현이 다르다: DB 는 timestamptz 를 `+00:00` 으로 돌려주고 스크래퍼는
 * `to_kst_iso` 로 `+09:00` 을 보낸다. 문자열로 비교하면 매 실행마다 전 행이
 * '변경됨' 으로 잡힌다 — 이 파일의 기본값이 그 함정을 상시 노출시킨다.
 */
const prev: ClosingComparable = {
  university_name: "국립군산대학교",
  region: "전북",
  service_name: "2027학년도 수시모집",
  university_type: "4년제",
  category: "수시",
  admission_type: "공통원서",
  operator_name: "박운영",
  developer_name: "김개발",
  write_start_at: "2026-09-07T00:00:00+00:00",
  write_end_at: "2026-09-11T09:00:00+00:00",
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
};

const next: ClosingIngestRow = {
  service_id: 1035061,
  university_name: "국립군산대학교",
  region: "전북",
  service_name: "2027학년도 수시모집",
  university_type: "4년제",
  category: "수시",
  admission_type: "공통원서",
  operator_name: "박운영",
  developer_name: "김개발",
  write_start_at: "2026-09-07T09:00:00+09:00",
  write_end_at: "2026-09-11T18:00:00+09:00",
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
};

describe("diffClosingRow — 변경 없음", () => {
  it("같은 값이면 빈 배열", () => {
    expect(diffClosingRow(prev, next)).toEqual([]);
  });

  it("시각은 오프셋이 달라도 같은 순간이면 변경이 아니다 (+09:00 vs +00:00)", () => {
    const changes = diffClosingRow(
      { ...prev, write_start_at: "2026-09-07T00:00:00+00:00" },
      { ...next, write_start_at: "2026-09-07T09:00:00+09:00" },
    );
    expect(changes).toEqual([]);
  });

  it("DB 가 밀리초·Z 표기로 돌려줘도 같은 순간이면 변경이 아니다", () => {
    const changes = diffClosingRow(
      { ...prev, write_end_at: "2026-09-11T09:00:00.000Z" },
      { ...next, write_end_at: "2026-09-11T18:00:00+09:00" },
    );
    expect(changes).toEqual([]);
  });

  it("payload 의 undefined(optional 누락)와 DB 의 null 은 같은 값이다", () => {
    const {
      pay_start_at: _a,
      pay_end_at: _b,
      region: _c,
      ...withoutOptionals
    } = next;
    void _a;
    void _b;
    void _c;
    const changes = diffClosingRow(
      { ...prev, pay_start_at: null, pay_end_at: null, region: null },
      withoutOptionals,
    );
    expect(changes).toEqual([]);
  });
});

describe("diffClosingRow — 변경 감지", () => {
  it("solo false → true (국립군산대 실제 증상)", () => {
    const changes = diffClosingRow(prev, { ...next, solo: true });
    expect(changes).toEqual([
      { field: "solo", prev_value: "false", next_value: "true" },
    ]);
  });

  it("텍스트 필드 변경", () => {
    const changes = diffClosingRow(prev, { ...next, operator_name: "이운영" });
    expect(changes).toEqual([
      { field: "operator_name", prev_value: "박운영", next_value: "이운영" },
    ]);
  });

  it("시각이 실제로 다르면 감지하고, 저장값은 UTC 로 정규화해 비교 가능하게 남긴다", () => {
    const changes = diffClosingRow(prev, {
      ...next,
      write_end_at: "2026-09-12T18:00:00+09:00",
    });
    expect(changes).toEqual([
      {
        field: "write_end_at",
        prev_value: "2026-09-11T09:00:00.000Z",
        next_value: "2026-09-12T09:00:00.000Z",
      },
    ]);
  });

  it("null → 값 (비어 있던 칸이 채워짐)", () => {
    const changes = diffClosingRow(prev, {
      ...next,
      pay_end_at: "2026-09-11T18:00:00+09:00",
    });
    expect(changes).toEqual([
      {
        field: "pay_end_at",
        prev_value: null,
        next_value: "2026-09-11T09:00:00.000Z",
      },
    ]);
  });

  it("값 → null (칸이 비워짐)", () => {
    const changes = diffClosingRow(
      { ...prev, region: "전라북도" },
      { ...next, region: null },
    );
    expect(changes).toEqual([
      { field: "region", prev_value: "전라북도", next_value: null },
    ]);
  });

  it("여러 필드가 동시에 바뀌면 전부 돌려준다", () => {
    const changes = diffClosingRow(prev, {
      ...next,
      solo: true,
      category: "정시",
      developer_name: null,
    });
    expect(changes.map((c) => c.field).sort()).toEqual([
      "category",
      "developer_name",
      "solo",
    ]);
  });
});

describe("CLOSING_DIFF_FIELDS", () => {
  it("service_id 를 제외한 13 필드를 전부 비교한다 (service_id 는 매칭 키)", () => {
    expect([...CLOSING_DIFF_FIELDS].sort()).toEqual([
      "admission_type",
      "category",
      "developer_name",
      "operator_name",
      "pay_end_at",
      "pay_start_at",
      "region",
      "service_name",
      "solo",
      "university_name",
      "university_type",
      "write_end_at",
      "write_start_at",
    ]);
  });

  it("DB read 스키마가 비교 필드를 전부 담는다 (빠지면 거짓 변경이 전 행에 찍힌다)", () => {
    expect(Object.keys(closingComparableSchema.shape).sort()).toEqual(
      ["service_id", ...CLOSING_DIFF_FIELDS].sort(),
    );
  });

  it("모든 필드가 실제로 비교된다 — 하나씩 바꾸면 하나씩 잡힌다", () => {
    const bumped: Record<ClosingComparableKey, string | boolean | null> = {
      university_name: "변경대학교",
      region: "변경지역",
      service_name: "변경서비스",
      university_type: "전문대",
      category: "정시",
      admission_type: "일반접수",
      operator_name: "변경운영",
      developer_name: "변경개발",
      write_start_at: "2030-01-01T00:00:00+09:00",
      write_end_at: "2030-01-02T00:00:00+09:00",
      pay_start_at: "2030-01-03T00:00:00+09:00",
      pay_end_at: "2030-01-04T00:00:00+09:00",
      solo: true,
    };
    for (const field of CLOSING_DIFF_FIELDS) {
      const changes = diffClosingRow(prev, { ...next, [field]: bumped[field] });
      expect(changes.map((c) => c.field)).toEqual([field]);
    }
  });
});

type ClosingComparableKey = keyof ClosingComparable;
