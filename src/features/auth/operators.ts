/**
 * 운영부 멤버 화이트리스트 (17명).
 *
 * signUp 가능 이메일은 이 리스트로 제한. dashboard 인원 통계 카드에서도 재사용.
 *
 * 직급 분류:
 *   - 부장 / 팀장: 2명 (운영1팀 부장 + 운영2팀 팀장)
 *   - TL: 2명
 *   - 매니저: 13명
 *   - 합계: 17명
 */

export type OperatorTeam = "운영1팀" | "운영2팀";
export type OperatorRole = "부장" | "팀장" | "TL" | "매니저";

export type Operator = {
  name: string;
  email: string;
  team: OperatorTeam;
  role: OperatorRole;
};

export const OPERATORS: readonly Operator[] = [
  // 운영1팀 (8명)
  { name: "허승철", email: "alcure23@jinhakapply.com", team: "운영1팀", role: "부장" },
  { name: "한효진", email: "hhj@jinhakapply.com", team: "운영1팀", role: "TL" },
  { name: "김슬기", email: "bluewhich87@jinhakapply.com", team: "운영1팀", role: "매니저" },
  { name: "김지영", email: "kjy0926@jinhakapply.com", team: "운영1팀", role: "매니저" },
  { name: "정윤나", email: "annooy@jinhakapply.com", team: "운영1팀", role: "매니저" },
  { name: "김유민", email: "sept98@jinhakapply.com", team: "운영1팀", role: "매니저" },
  { name: "기자의", email: "jkee@jinhakapply.com", team: "운영1팀", role: "매니저" },
  { name: "전지은", email: "jje@jinhakapply.com", team: "운영1팀", role: "매니저" },

  // 운영2팀 (9명)
  { name: "송영신", email: "ys1114@jinhakapply.com", team: "운영2팀", role: "팀장" },
  { name: "박시현", email: "pkm0313@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "윤지혜", email: "wnlgp@jinhakapply.com", team: "운영2팀", role: "TL" },
  { name: "이해영", email: "haelee0201@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "임종우", email: "rsjw2014@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "전혜인", email: "hogj1213@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "김지현", email: "kjh@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "김지나", email: "kjn@jinhakapply.com", team: "운영2팀", role: "매니저" },
  { name: "김승현", email: "ksh@jinhakapply.com", team: "운영2팀", role: "매니저" },
] as const;

export const ALLOWED_EMAILS: ReadonlySet<string> = new Set(
  OPERATORS.map((op) => op.email)
);
