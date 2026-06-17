import { describe, it, expect } from "vitest";
import { parsePastedContacts, toContactCreate } from "../paste-parse";

describe("parsePastedContacts", () => {
  it("헤더 별칭 + 열 순서 무관 매핑", () => {
    const text = "고객명\t대학명\t이메일\n김담당\t서강대학교\tkim@x.com";
    const r = parsePastedContacts(text);
    expect(r.headerError).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values).toMatchObject({
      customer_name: "김담당",
      university_name: "서강대학교",
      contact_email: "kim@x.com",
    });
    expect(r.rows[0].errors).toEqual([]);
  });

  it("필수 헤더(대학명/고객명) 없으면 headerError", () => {
    const r = parsePastedContacts("이메일\ta@x.com");
    expect(r.headerError).toBeTruthy();
    expect(r.rows).toEqual([]);
  });

  it("필수값 누락 행은 errors", () => {
    const text = "대학명\t고객명\n서강대\t\n\t박담당";
    const r = parsePastedContacts(text);
    expect(r.rows[0].errors).toContain("고객명 누락");
    expect(r.rows[1].errors).toContain("대학명 누락");
  });

  it("매핑 안 된 헤더는 unmappedHeaders, 빈 줄 무시", () => {
    const text = "대학명\t고객명\t메모\n서강대\t김담당\t비고\n\n";
    const r = parsePastedContacts(text);
    expect(r.unmappedHeaders).toContain("메모");
    expect(r.rows).toHaveLength(1);
  });

  it("customer_active 미입력 시 기본 '재직'", () => {
    const r = parsePastedContacts("대학명\t고객명\n서강대\t김담당");
    expect(r.rows[0].values.customer_active).toBe("재직");
  });
});

describe("toContactCreate", () => {
  it("누락 nullable 필드는 null, customer_active 기본 재직", () => {
    const c = toContactCreate({
      university_name: "서강대",
      customer_name: "김담당",
    });
    expect(c).toEqual({
      customer_active: "재직",
      customer_name: "김담당",
      university_name: "서강대",
      job_title: null,
      department_name: null,
      job_role: null,
      management_grade: null,
      relationship_grade: null,
      contact_phone: null,
      contact_ext: null,
      contact_email: null,
    });
  });
});
