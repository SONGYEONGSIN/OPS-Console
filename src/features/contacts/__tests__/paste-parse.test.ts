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

  it("탭 없이 ' · '(가운뎃점) 구분자도 인식한다", () => {
    const text =
      "대학명 · 고객명 · 이메일 · 전화\n서강대 · 김담당 · kim@sg.ac.kr · 02-705-1234";
    const r = parsePastedContacts(text);
    expect(r.headerError).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values).toMatchObject({
      university_name: "서강대",
      customer_name: "김담당",
      contact_email: "kim@sg.ac.kr",
      contact_phone: "02-705-1234",
    });
    expect(r.rows[0].errors).toEqual([]);
  });

  it("쉼표 구분자도 인식한다", () => {
    const text = "대학명,고객명\n연세대,박과장";
    const r = parsePastedContacts(text);
    expect(r.headerError).toBeUndefined();
    expect(r.rows[0].values).toMatchObject({
      university_name: "연세대",
      customer_name: "박과장",
    });
  });

  it("필수 헤더(대학명/고객명) 없으면 headerError", () => {
    const r = parsePastedContacts("이메일\ta@x.com");
    expect(r.headerError).toBeTruthy();
    expect(r.rows).toEqual([]);
  });

  it("붙여넣기 내 중복 행(대학명+고객명 동일)은 2번째부터 중복 error", () => {
    const text = "대학명\t고객명\n서강대\t김담당\n서강대\t김담당\n연세대\t박과장";
    const r = parsePastedContacts(text);
    expect(r.rows[0].errors).toEqual([]); // 첫 등장은 유효
    expect(r.rows[1].errors.some((e) => e.includes("중복"))).toBe(true);
    expect(r.rows[2].errors).toEqual([]); // 다른 건은 유효
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
