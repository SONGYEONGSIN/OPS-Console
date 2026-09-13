import { describe, it, expect } from "vitest";
import {
  operatorRowSchema,
  operatorUpdateSchema,
  operatorCreateSchema,
  operatorRoleSchema,
} from "../schemas";

describe("operatorRowSchema", () => {
  it("정상 row 통과", () => {
    const row = {
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      email: "test@example.com",
      name: "홍길동",
      team: "운영1팀",
      role: "매니저",
      emp_no: "20240101",
      hired_at: "2024-01-01",
      birth_date: "1990-01-01",
      gender: "남",
      division: "어플라이사업본부",
      department: "운영부",
      status: "active",
      permission: "member",
      leader: null,
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
    };
    const result = operatorRowSchema.safeParse(row);
    expect(result.success).toBe(true);
  });

  it("잘못된 status — 거부", () => {
    const result = operatorRowSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      email: "x@y.com",
      name: "x",
      team: "운영1팀",
      role: "매니저",
      emp_no: "1",
      hired_at: "2024-01-01",
      birth_date: "1990-01-01",
      gender: "남",
      division: "어플라이사업본부",
      department: "운영부",
      status: "BAD",
      leader: null,
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("operatorRowSchema permission", () => {
  const baseRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    email: "x@y.com",
    name: "x",
    team: "운영1팀",
    role: "매니저",
    emp_no: "1",
    hired_at: "2024-01-01",
    birth_date: "1990-01-01",
    gender: "남",
    division: "어플라이사업본부",
    department: "운영부",
    status: "active",
    leader: null,
    created_at: "2026-05-09T00:00:00Z",
    updated_at: "2026-05-09T00:00:00Z",
  };

  it("permission='admin' 정상 통과 + data.permission 노출", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, permission: "admin" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.permission).toBe("admin");
  });

  it("permission 잘못된 enum 거부", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, permission: "BAD" });
    expect(r.success).toBe(false);
  });

  it("permission 누락 거부 (필수 필드)", () => {
    const r = operatorRowSchema.safeParse(baseRow);
    expect(r.success).toBe(false);
  });
});

describe("operatorRowSchema allowed_menus", () => {
  const baseRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    email: "x@y.com",
    name: "x",
    team: "운영1팀",
    role: "매니저",
    emp_no: "1",
    hired_at: "2024-01-01",
    birth_date: "1990-01-01",
    gender: "남",
    division: "어플라이사업본부",
    department: "운영부",
    status: "active",
    permission: "member",
    leader: null,
    created_at: "2026-05-09T00:00:00Z",
    updated_at: "2026-05-09T00:00:00Z",
  };

  it("allowed_menus 배열 통과 + 노출", () => {
    const r = operatorRowSchema.safeParse({
      ...baseRow,
      allowed_menus: ["alerts", "services", "feedback"],
    });
    expect(r.success).toBe(true);
    if (r.success)
      expect(r.data.allowed_menus).toEqual(["alerts", "services", "feedback"]);
  });

  it("allowed_menus 빈 배열 통과", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, allowed_menus: [] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.allowed_menus).toEqual([]);
  });

  it("allowed_menus 누락 시 default []", () => {
    const r = operatorRowSchema.safeParse(baseRow);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.allowed_menus).toEqual([]);
  });

  it("allowed_menus 비-string 항목 거부", () => {
    const r = operatorRowSchema.safeParse({
      ...baseRow,
      allowed_menus: ["alerts", 42],
    });
    expect(r.success).toBe(false);
  });
});

describe("operatorRowSchema mail_cc_excluded", () => {
  const baseRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    email: "x@y.com",
    name: "x",
    team: "운영1팀",
    role: "매니저",
    emp_no: "1",
    hired_at: "2024-01-01",
    birth_date: "1990-01-01",
    gender: "남",
    division: "어플라이사업본부",
    department: "운영부",
    status: "active",
    permission: "member",
    leader: null,
    created_at: "2026-05-09T00:00:00Z",
    updated_at: "2026-05-09T00:00:00Z",
  };

  it("mail_cc_excluded=true 통과 + 노출", () => {
    const r = operatorRowSchema.safeParse({
      ...baseRow,
      mail_cc_excluded: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mail_cc_excluded).toBe(true);
  });

  it("mail_cc_excluded 누락 시 default false", () => {
    const r = operatorRowSchema.safeParse(baseRow);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mail_cc_excluded).toBe(false);
  });

  it("mail_cc_excluded 비-boolean 거부", () => {
    const r = operatorRowSchema.safeParse({
      ...baseRow,
      mail_cc_excluded: "yes",
    });
    expect(r.success).toBe(false);
  });
});

describe("operatorUpdateSchema mail_cc_excluded", () => {
  it("mail_cc_excluded만 update OK + data 노출", () => {
    const r = operatorUpdateSchema.safeParse({ mail_cc_excluded: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mail_cc_excluded).toBe(true);
  });

  it("mail_cc_excluded 비-boolean 거부", () => {
    expect(
      operatorUpdateSchema.safeParse({ mail_cc_excluded: "yes" }).success,
    ).toBe(false);
  });
});

describe("operatorUpdateSchema allowed_menus", () => {
  it("allowed_menus만 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ allowed_menus: ["team", "settings"] })
        .success,
    ).toBe(true);
  });

  it("allowed_menus 비-array 거부", () => {
    expect(
      operatorUpdateSchema.safeParse({ allowed_menus: "alerts" }).success,
    ).toBe(false);
  });
});

describe("operatorUpdateSchema", () => {
  it("부분 update OK", () => {
    expect(operatorUpdateSchema.safeParse({ status: "inactive" }).success).toBe(
      true,
    );
  });

  it("permission만 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ permission: "viewer" }).success,
    ).toBe(true);
  });

  it("permission 잘못된 enum 거부", () => {
    expect(operatorUpdateSchema.safeParse({ permission: "BAD" }).success).toBe(
      false,
    );
  });
});

describe("operatorCreateSchema", () => {
  it("필수 필드 모두 — 통과 (status default active)", () => {
    const r = operatorCreateSchema.safeParse({
      email: "new@example.com",
      name: "신규",
      team: "운영1팀",
      role: "매니저",
      emp_no: "20260101",
      hired_at: "2026-01-01",
      birth_date: "2000-01-01",
      gender: "여",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("active");
  });

  it("이메일 누락 — 거부", () => {
    expect(
      operatorCreateSchema.safeParse({
        name: "x",
        team: "운영1팀",
        role: "매니저",
        emp_no: "x",
        hired_at: "2024-01-01",
        birth_date: "1990-01-01",
        gender: "남",
      }).success,
    ).toBe(false);
  });
});

describe("operatorRoleSchema 확장", () => {
  it("본부장/사장 role을 허용한다", () => {
    expect(operatorRoleSchema.safeParse("본부장").success).toBe(true);
    expect(operatorRoleSchema.safeParse("사장").success).toBe(true);
  });

  it("기존 role도 유효", () => {
    expect(operatorRoleSchema.safeParse("부장").success).toBe(true);
    expect(operatorRoleSchema.safeParse("팀장").success).toBe(true);
    expect(operatorRoleSchema.safeParse("TL").success).toBe(true);
    expect(operatorRoleSchema.safeParse("매니저").success).toBe(true);
  });
});

describe("operatorRowSchema 배정 칸 셋", () => {
  const baseRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    email: "x@y.com",
    name: "x",
    team: "운영1팀",
    role: "매니저",
    emp_no: "1",
    hired_at: "2024-01-01",
    birth_date: "1990-01-01",
    gender: "남",
    division: "어플라이사업본부",
    department: "운영부",
    status: "active",
    permission: "member",
    leader: null,
    created_at: "2026-05-09T00:00:00Z",
    updated_at: "2026-05-09T00:00:00Z",
  };

  it("assignable=true 통과 + 노출", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, assignable: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.assignable).toBe(true);
  });

  // DB default 가 false 다 — 새로 들어온 사람에게 대학이 저절로 배정되지 않는다.
  it("assignable 누락 시 default false", () => {
    const r = operatorRowSchema.safeParse(baseRow);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.assignable).toBe(false);
  });

  it("assignable 비-boolean 거부", () => {
    expect(
      operatorRowSchema.safeParse({ ...baseRow, assignable: "yes" }).success,
    ).toBe(false);
  });

  it("tenure_group 등록값 통과 + 노출", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, tenure_group: "3" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tenure_group).toBe("3");
  });

  it("tenure_group 미등록값 거부", () => {
    expect(
      operatorRowSchema.safeParse({ ...baseRow, tenure_group: "7" }).success,
    ).toBe(false);
  });

  // 아직 그룹을 안 정한 사람이 있다 — 배분현황이 '그룹 미설정' 줄로 드러낸다(F4).
  it("tenure_group null 통과", () => {
    const r = operatorRowSchema.safeParse({ ...baseRow, tenure_group: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tenure_group).toBeNull();
  });

  it("career_start_at 통과 + 노출", () => {
    const r = operatorRowSchema.safeParse({
      ...baseRow,
      career_start_at: "2011-02-07",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.career_start_at).toBe("2011-02-07");
  });

  it("career_start_at null 통과 — null 이면 hired_at 을 쓴다", () => {
    expect(
      operatorRowSchema.safeParse({ ...baseRow, career_start_at: null })
        .success,
    ).toBe(true);
  });
});

describe("operatorUpdateSchema 배정 칸 셋", () => {
  it("assignable만 update OK + data 노출", () => {
    const r = operatorUpdateSchema.safeParse({ assignable: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.assignable).toBe(true);
  });

  it("tenure_group만 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ tenure_group: "1-2" }).success,
    ).toBe(true);
  });

  it("tenure_group 미등록값 거부 — DB 에 check 가 없어 여기가 유일한 관문이다", () => {
    expect(operatorUpdateSchema.safeParse({ tenure_group: "7" }).success).toBe(
      false,
    );
  });

  it("tenure_group null update OK — 그룹을 비울 수 있다", () => {
    expect(operatorUpdateSchema.safeParse({ tenure_group: null }).success).toBe(
      true,
    );
  });

  it("career_start_at만 update OK", () => {
    expect(
      operatorUpdateSchema.safeParse({ career_start_at: "2011-02-07" }).success,
    ).toBe(true);
  });

  it("assignable 비-boolean 거부", () => {
    expect(operatorUpdateSchema.safeParse({ assignable: "yes" }).success).toBe(
      false,
    );
  });
});
