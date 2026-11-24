import { describe, it, expect } from "vitest";
import { pickApprovalChain } from "../queries";

const rows = [
  { email: "a@x.com", name: "이해영", team: "운영1팀", role: "매니저", leader: "송영신" },
  { email: "b@x.com", name: "송영신", team: "운영1팀", role: "팀장", leader: null },
  { email: "c@x.com", name: "이이화", team: "운영1팀", role: "본부장", leader: null },
  { email: "d@x.com", name: "주정현", team: "운영2팀", role: "사장", leader: null },
];

describe("pickApprovalChain", () => {
  it("작성자 leader 이름으로 팀장 매칭 + 본부장/사장 자동", () => {
    const chain = pickApprovalChain(rows[0], rows);
    expect(chain.approver?.name).toBe("송영신");
    expect(chain.approver?.email).toBe("b@x.com");
    expect(chain.director?.name).toBe("이이화");
    expect(chain.ceo?.name).toBe("주정현");
  });
  it("leader 없으면 같은 팀 role=팀장 fallback", () => {
    const author = { email: "z@x.com", name: "신입", team: "운영1팀", role: "매니저", leader: null };
    const chain = pickApprovalChain(author, [...rows, author]);
    expect(chain.approver?.name).toBe("송영신");
  });
  it("팀장/본부장/사장 없으면 null", () => {
    const lone = { email: "q@x.com", name: "혼자", team: "운영3팀", role: "매니저", leader: null };
    const chain = pickApprovalChain(lone, [lone]);
    expect(chain.approver).toBeNull();
    expect(chain.director).toBeNull();
    expect(chain.ceo).toBeNull();
    expect(chain.author.name).toBe("혼자");
  });
  it("영업팀은 결재선에 안 든다 — 영업팀 부장·이사가 먼저 등록돼 있어도 운영 쪽을 고른다", () => {
    const sales = [
      { email: "s1@x.com", name: "영업부장", team: "영업팀", role: "부장", leader: null },
      { email: "s2@x.com", name: "영업이사", team: "영업팀", role: "이사", leader: null },
      { email: "s3@x.com", name: "영업팀장", team: "영업팀", role: "팀장", leader: null },
    ];
    const ops = [
      { email: "a@x.com", name: "작성", team: "운영1팀", role: "매니저", leader: null },
      { email: "b@x.com", name: "운영부장", team: "운영1팀", role: "부장", leader: null },
      { email: "c@x.com", name: "운영이사", team: "운영1팀", role: "이사", leader: null },
      { email: "t@x.com", name: "운영팀장", team: "운영1팀", role: "팀장", leader: null },
    ];
    const chain = pickApprovalChain(ops[0], [...sales, ...ops]);
    expect(chain.director?.name).toBe("운영부장");
    expect(chain.ceo?.name).toBe("운영이사");
    expect(chain.approver?.name).toBe("운영팀장");
  });
});
