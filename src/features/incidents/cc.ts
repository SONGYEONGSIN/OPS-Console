import type { AssignmentSheet } from "@/features/assignments/schemas";
import { normalizeUniversityName } from "@/features/assignments/import";
import { SALES_TEAM } from "@/features/auth/operators";

/**
 * 사고보고 메일 참조(CC) — **4년제 대학이면 이사님 + 그 대학 영업자**(사용자 지시 2026-11-24).
 *
 * 대분류·영업자는 총괄장 `02. 배정리스트` 의 `대분류`·`영업자` 칸이 정본이다. 영업자 칸에는
 * 이름만 있어서 조직권한의 **영업팀** 명단에서 같은 이름을 찾아 메일로 바꾼다.
 *
 * 이사님(이이화)은 운영자 메일 참조 제외(`mail_cc_excluded`)가 켜져 있지만 여기서는 넣는다 —
 * 사고보고 4년제 건만의 예외로 사용자가 정했다. 다른 메일의 참조 제외는 그대로다.
 */

export type CcOperator = {
  email: string;
  name: string;
  team: string | null;
  role: string;
  status: string;
};

export type UniversitySales = { universityType: string; salesName: string };

export type IncidentCc = {
  cc: { email: string; name: string }[];
  /** 시트에 영업자 이름은 있는데 조직권한 영업팀에서 못 찾았다 — 조용히 빠지지 않게 알린다. */
  unmatchedSales: string | null;
};

const FOUR_YEAR = "4년제";

/** 배정리스트에서 그 대학의 대분류·영업자. 대학이 없거나 칸을 못 찾으면 null. */
export function findUniversitySales(
  sheet: AssignmentSheet,
  university: string,
): UniversitySales | null {
  const header = sheet.rowsText[0] ?? [];
  const col = (label: string) => header.findIndex((c) => c.trim() === label);
  const uniCol = col("대학명");
  const typeCol = col("대분류");
  const salesCol = col("영업자");
  if (uniCol < 0 || typeCol < 0 || salesCol < 0) return null;

  const target = normalizeUniversityName(university);
  // r1 은 하위유형 줄이라 데이터는 r2 부터다.
  const row = sheet.rowsText
    .slice(2)
    .find((r) => normalizeUniversityName(r[uniCol] ?? "") === target);
  if (!row) return null;
  return {
    universityType: (row[typeCol] ?? "").trim(),
    salesName: (row[salesCol] ?? "").trim(),
  };
}

export function pickIncidentCc(input: {
  sales: UniversitySales | null;
  operators: CcOperator[];
  reporterEmail: string;
}): IncidentCc {
  const { sales, operators, reporterEmail } = input;
  if (!sales || sales.universityType !== FOUR_YEAR) {
    return { cc: [], unmatchedSales: null };
  }
  const active = operators.filter((o) => o.status === "active");
  const directors = active.filter(
    (o) => o.role === "이사" && o.team !== SALES_TEAM,
  );
  const salesPeople = sales.salesName
    ? active.filter(
        (o) => o.team === SALES_TEAM && o.name.trim() === sales.salesName,
      )
    : [];

  const seen = new Set([reporterEmail]);
  const cc = [...directors, ...salesPeople].flatMap((o) => {
    if (seen.has(o.email)) return [];
    seen.add(o.email);
    return [{ email: o.email, name: o.name }];
  });
  return {
    cc,
    unmatchedSales:
      sales.salesName && salesPeople.length === 0 ? sales.salesName : null,
  };
}
