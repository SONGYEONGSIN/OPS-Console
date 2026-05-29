/**
 * 운영부 조직구성 — 17명 실 인사 데이터.
 *
 * 운영부 = 어플라이사업본부 / 운영1팀 + 운영2팀.
 * signUp 가능 이메일은 이 리스트로 제한. dashboard 인원 통계 + 인스펙터 풍부 표시에 재사용.
 */

export type OperatorTeam = "운영1팀" | "운영2팀";
export type OperatorRole = "부장" | "팀장" | "TL" | "매니저";
export type OperatorGender = "남" | "여";

export type Operator = {
  name: string;
  email: string;
  team: OperatorTeam;
  role: OperatorRole;
  empNo: string;
  hiredAt: string;
  birthDate: string;
  gender: OperatorGender;
  division: "어플라이사업본부";
  department: "운영부";
};

const D = "어플라이사업본부" as const;
const E = "운영부" as const;

const REAL_OPERATORS: readonly Operator[] = [
  { name: "허승철", email: "alcure23@jinhakapply.com",   team: "운영1팀", role: "부장",   empNo: "200806010", hiredAt: "2008-06-01", birthDate: "1982-10-06", gender: "남", division: D, department: E },
  { name: "한효진", email: "hhj@jinhakapply.com",         team: "운영1팀", role: "TL",     empNo: "20220701",  hiredAt: "2007-05-30", birthDate: "1981-06-14", gender: "남", division: D, department: E },
  { name: "김슬기", email: "bluewhich87@jinhakapply.com", team: "운영1팀", role: "매니저", empNo: "20150703",  hiredAt: "2011-02-07", birthDate: "1987-06-09", gender: "여", division: D, department: E },
  { name: "김지영", email: "kjy0926@jinhakapply.com",     team: "운영1팀", role: "매니저", empNo: "20160702",  hiredAt: "2016-07-27", birthDate: "1989-09-26", gender: "여", division: D, department: E },
  { name: "정윤나", email: "annooy@jinhakapply.com",      team: "운영1팀", role: "매니저", empNo: "20190801",  hiredAt: "2019-08-01", birthDate: "1995-09-16", gender: "여", division: D, department: E },
  { name: "김유민", email: "sept98@jinhakapply.com",      team: "운영1팀", role: "매니저", empNo: "20230506",  hiredAt: "2023-05-18", birthDate: "1998-09-07", gender: "여", division: D, department: E },
  { name: "기자의", email: "jkee@jinhakapply.com",        team: "운영1팀", role: "매니저", empNo: "20240501",  hiredAt: "2024-05-02", birthDate: "1999-03-13", gender: "여", division: D, department: E },
  { name: "전지은", email: "jje@jinhakapply.com",         team: "운영1팀", role: "매니저", empNo: "20250701",  hiredAt: "2025-07-14", birthDate: "2001-03-12", gender: "여", division: D, department: E },
  { name: "송영신", email: "ys1114@jinhakapply.com",      team: "운영2팀", role: "팀장",   empNo: "20131004",  hiredAt: "2013-10-14", birthDate: "1987-12-01", gender: "남", division: D, department: E },
  { name: "박시현", email: "pkm0313@jinhakapply.com",     team: "운영2팀", role: "매니저", empNo: "201008010", hiredAt: "2010-08-05", birthDate: "1984-03-13", gender: "여", division: D, department: E },
  { name: "윤지혜", email: "wnlgp@jinhakapply.com",       team: "운영2팀", role: "TL",     empNo: "200505310", hiredAt: "2005-05-30", birthDate: "1984-10-22", gender: "여", division: D, department: E },
  { name: "이해영", email: "haelee0201@jinhakapply.com",  team: "운영2팀", role: "매니저", empNo: "20170602",  hiredAt: "2017-06-12", birthDate: "1993-02-01", gender: "여", division: D, department: E },
  { name: "임종우", email: "rsjw2014@jinhakapply.com",    team: "운영2팀", role: "매니저", empNo: "20220101",  hiredAt: "2022-01-10", birthDate: "1995-08-20", gender: "남", division: D, department: E },
  { name: "전혜인", email: "hogj1213@jinhakapply.com",    team: "운영2팀", role: "매니저", empNo: "20230505",  hiredAt: "2023-05-18", birthDate: "1998-12-13", gender: "여", division: D, department: E },
  { name: "김승현", email: "ksh@jinhakapply.com",         team: "운영2팀", role: "매니저", empNo: "P20250505", hiredAt: "2025-10-27", birthDate: "2000-11-20", gender: "여", division: D, department: E },
  { name: "김지현", email: "kjh@jinhakapply.com",         team: "운영2팀", role: "매니저", empNo: "20240502",  hiredAt: "2024-05-02", birthDate: "1997-12-10", gender: "여", division: D, department: E },
  { name: "김지나", email: "kjn@jinhakapply.com",         team: "운영2팀", role: "매니저", empNo: "20240702",  hiredAt: "2024-07-08", birthDate: "2000-02-02", gender: "여", division: D, department: E },
] as const;

/**
 * 임시 테스트 계정 — 백업요청 등 기능 검증용. 운영부 실 인사 아님.
 * signUp 허용 + 팀/이름 표시(달력 '팀-이름-휴가유형')를 위해 등재.
 * 테스트 종료 후 제거: 이 배열을 비우고 `node scripts/delete-user.mjs`로 auth/operators row 정리.
 */
const TEST_OPERATORS: readonly Operator[] = [
  { name: "테스트1", email: "ysong2526@gmail.com", team: "운영2팀", role: "매니저", empNo: "TEST001", hiredAt: "2026-05-29", birthDate: "1990-01-01", gender: "남", division: D, department: E },
  { name: "테스트2", email: "yss040607@gmail.com", team: "운영2팀", role: "매니저", empNo: "TEST002", hiredAt: "2026-05-29", birthDate: "1990-01-01", gender: "남", division: D, department: E },
] as const;

export const OPERATORS: readonly Operator[] = [
  ...REAL_OPERATORS,
  ...TEST_OPERATORS,
];

export const ALLOWED_EMAILS: ReadonlySet<string> = new Set(
  OPERATORS.map((op) => op.email),
);

/**
 * 이메일 → 운영자 이름. 운영자 목록에 없으면 local-part(@앞)로 폴백,
 * 빈/누락 값은 빈 문자열. (담당자 라벨을 id 대신 이름으로 표시할 때 사용)
 */
export function operatorNameByEmail(email: string | null | undefined): string {
  if (!email) return "";
  const op = OPERATORS.find((o) => o.email === email);
  return op?.name ?? email.split("@")[0] ?? email;
}

export function tenureYears(hiredAt: string, baseDate?: Date): number {
  const base = baseDate ?? new Date();
  const hired = new Date(hiredAt + "T00:00:00+09:00");
  const ms = base.getTime() - hired.getTime();
  return Math.round((ms / (365.25 * 24 * 3600 * 1000)) * 100) / 100;
}

export function tenureLabel(hiredAt: string, baseDate?: Date): string {
  const base = baseDate ?? new Date();
  const hired = new Date(hiredAt + "T00:00:00+09:00");
  let years = base.getFullYear() - hired.getFullYear();
  let months = base.getMonth() - hired.getMonth();
  if (base.getDate() < hired.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}년 ${months}개월`;
}

export function ageOf(birthDate: string, baseDate?: Date): number {
  const base = baseDate ?? new Date();
  const birth = new Date(birthDate + "T00:00:00+09:00");
  let age = base.getFullYear() - birth.getFullYear();
  const m = base.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) age -= 1;
  return age;
}
