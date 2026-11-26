import { describe, it, expect } from "vitest";
import { pickApprovalChain, type OperatorLite } from "../queries";

/**
 * 실제 조직 모양(2026-11-26 조회) — 운영1팀은 팀장이 없고 부장 허승철이 겸임,
 * 운영2팀은 팀장 송영신, 본부장은 영업팀 밖 role 이사(이이화).
 * 영업팀에는 본부장·부장이 있지만 결재선에 들지 않는다.
 * 영업팀 행을 앞에 둬서 'DB 순서상 먼저 나오는 사람' 을 고르지 않는지도 본다.
 */
const org: OperatorLite[] = [
  {
    email: "s1@x.com",
    name: "이건목",
    team: "영업팀",
    role: "본부장",
    leader: null,
    emp_no: "1001",
  },
  {
    email: "s2@x.com",
    name: "이창욱",
    team: "영업팀",
    role: "부장",
    leader: null,
    emp_no: "1002",
  },
  {
    email: "h@x.com",
    name: "허승철",
    team: "운영1팀",
    role: "부장",
    leader: null,
    emp_no: "2001",
  },
  {
    email: "y@x.com",
    name: "송영신",
    team: "운영2팀",
    role: "팀장",
    leader: null,
    emp_no: "2002",
  },
  {
    email: "i@x.com",
    name: "이이화",
    team: "운영1팀",
    role: "이사",
    leader: "이사",
    emp_no: "2000",
  },
  {
    email: "k@x.com",
    name: "기자의",
    team: "운영1팀",
    role: "매니저",
    leader: null,
    emp_no: "3001",
  },
  {
    email: "w@x.com",
    name: "윤지혜",
    team: "운영2팀",
    role: "TL",
    leader: null,
    emp_no: "3002",
  },
];
const byName = (name: string) => org.find((o) => o.name === name)!;

describe("pickApprovalChain — 담당자·팀장·부장·본부장", () => {
  it("운영1팀 매니저 → 팀장·부장 모두 허승철(겸임), 본부장 이이화", () => {
    const chain = pickApprovalChain(byName("기자의"), org);
    expect(chain.author.name).toBe("기자의");
    expect(chain.approver).toEqual({
      name: "허승철",
      email: "h@x.com",
      role: "부장",
    });
    expect(chain.director?.name).toBe("허승철");
    expect(chain.ceo?.name).toBe("이이화");
  });

  it("운영2팀 TL → 팀장 송영신, 부장 허승철(같은 팀에 없어 전사에서), 본부장 이이화", () => {
    const chain = pickApprovalChain(byName("윤지혜"), org);
    expect(chain.approver?.name).toBe("송영신");
    expect(chain.approver?.email).toBe("y@x.com");
    expect(chain.director?.name).toBe("허승철");
    expect(chain.ceo?.name).toBe("이이화");
  });

  it("leader 이름이 있으면 그 사람이 팀장", () => {
    const duty = { ...byName("기자의"), leader: "송영신" };
    const chain = pickApprovalChain(duty, org);
    expect(chain.approver?.name).toBe("송영신");
  });

  it("영업팀 본부장·부장은 무시 — 영업팀 밖에 본부장·사장 role 만 있으면 본부장 칸은 비고, 부장 칸도 운영 쪽만", () => {
    const ops: OperatorLite[] = [
      {
        email: "a@x.com",
        name: "작성",
        team: "운영1팀",
        role: "매니저",
        leader: null,
        emp_no: "5",
      },
      {
        email: "b@x.com",
        name: "운영본부장",
        team: "운영1팀",
        role: "본부장",
        leader: null,
        emp_no: "1",
      },
      {
        email: "c@x.com",
        name: "운영사장",
        team: "운영2팀",
        role: "사장",
        leader: null,
        emp_no: "2",
      },
    ];
    const sales: OperatorLite[] = [
      {
        email: "s1@x.com",
        name: "영업본부장",
        team: "영업팀",
        role: "본부장",
        leader: null,
        emp_no: "0",
      },
      {
        email: "s2@x.com",
        name: "영업부장",
        team: "영업팀",
        role: "부장",
        leader: null,
        emp_no: "0",
      },
      {
        email: "s3@x.com",
        name: "영업이사",
        team: "영업팀",
        role: "이사",
        leader: null,
        emp_no: "0",
      },
      {
        email: "s4@x.com",
        name: "영업팀장",
        team: "영업팀",
        role: "팀장",
        leader: null,
        emp_no: "0",
      },
    ];
    const chain = pickApprovalChain(ops[0], [...sales, ...ops]);
    expect(chain.approver).toBeNull();
    expect(chain.director).toBeNull();
    expect(chain.ceo).toBeNull();
  });

  it("부장·이사가 여럿 → 부장은 같은 팀 우선, 그다음 emp_no 오름차순", () => {
    const rows: OperatorLite[] = [
      {
        email: "d9@x.com",
        name: "다른팀부장",
        team: "운영2팀",
        role: "부장",
        leader: null,
        emp_no: "0100",
      },
      {
        email: "d1@x.com",
        name: "같은팀부장뒤",
        team: "운영1팀",
        role: "부장",
        leader: null,
        emp_no: "0300",
      },
      {
        email: "d2@x.com",
        name: "같은팀부장앞",
        team: "운영1팀",
        role: "부장",
        leader: null,
        emp_no: "0200",
      },
      {
        email: "e2@x.com",
        name: "이사뒤",
        team: "운영2팀",
        role: "이사",
        leader: null,
        emp_no: "0900",
      },
      {
        email: "e1@x.com",
        name: "이사앞",
        team: "운영1팀",
        role: "이사",
        leader: null,
        emp_no: "0800",
      },
      {
        email: "m@x.com",
        name: "매니저",
        team: "운영1팀",
        role: "매니저",
        leader: null,
        emp_no: "9999",
      },
    ];
    const chain = pickApprovalChain(rows[5], rows);
    expect(chain.director?.name).toBe("같은팀부장앞");
    expect(chain.approver?.name).toBe("같은팀부장앞");
    expect(chain.ceo?.name).toBe("이사앞");

    const otherTeam = {
      email: "n@x.com",
      name: "3팀",
      team: "운영3팀",
      role: "매니저",
      leader: null,
      emp_no: "9",
    };
    const chain2 = pickApprovalChain(otherTeam, [...rows, otherTeam]);
    // 같은 팀 부장이 없으면 전사 부장 중 emp_no 가 가장 앞선 사람
    expect(chain2.director?.name).toBe("다른팀부장");
    // 같은 팀 팀장·부장이 없으면 팀장 칸은 비운다(전사 부장으로 넘기지 않는다)
    expect(chain2.approver).toBeNull();
  });

  it("후보가 하나도 없으면 셋 다 null", () => {
    const lone = {
      email: "q@x.com",
      name: "혼자",
      team: "운영3팀",
      role: "매니저",
      leader: null,
    };
    const chain = pickApprovalChain(lone, [lone]);
    expect(chain.approver).toBeNull();
    expect(chain.director).toBeNull();
    expect(chain.ceo).toBeNull();
    expect(chain.author.name).toBe("혼자");
  });
});
