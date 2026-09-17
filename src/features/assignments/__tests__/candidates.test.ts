import { describe, it, expect } from "vitest";
import { assignmentCandidates } from "../candidates";

/**
 * 배정 후보는 **`status='active'` 뿐**이다.
 *
 * 세 질문이 서로 다르다 — 누구를 **새로 배정**할 수 있나(정책), 이 이메일이
 * **누구인가**(사실), 이 주소로 **되돌릴 수 있나**(FK 제약). 뒤의 둘은 명부 전원이고,
 * 좁히는 것은 첫 번째뿐이다. 한 목록으로 뭉치면 삭제된 사람이 후보에 뜨거나
 * 이력의 이름이 안 풀린다.
 *
 * `assignable` 로 좁히지 않는다. 그 칸은 **자동 배정**의 대상 여부(설계 §3.4 —
 * 팀장·부장·이사·기획팀·테스트 계정이 false)이고, 수동 편집기는 자동이 못 다루는
 * 예외를 처리하는 자리다. 거기에 자동의 제외 규칙을 걸면 정당한 예외 배정을 막는다.
 */
const op = (email: string, name: string, status: string) => ({
  email,
  name,
  status,
});

describe("assignmentCandidates", () => {
  it("active 만 남긴다", () => {
    const rows = [
      op("a@x.com", "가운영", "active"),
      op("b@x.com", "나운영", "inactive"),
      op("c@x.com", "다운영", "suspended"),
      op("d@x.com", "라운영", "deleted"),
    ];

    expect(assignmentCandidates(rows)).toEqual([
      { email: "a@x.com", name: "가운영" },
    ]);
  });

  it("순서를 바꾸지 않는다 — 조회가 팀·입사일 순으로 준다", () => {
    // 가나다순으로 다시 세우면 같은 팀이 흩어져 드롭다운에서 찾기 어려워진다.
    const rows = [
      op("b@x.com", "나운영", "active"),
      op("a@x.com", "가운영", "active"),
    ];

    expect(assignmentCandidates(rows).map((o) => o.email)).toEqual([
      "b@x.com",
      "a@x.com",
    ]);
  });

  it("이메일과 이름만 넘긴다 — 나머지 칸은 화면에 갈 이유가 없다", () => {
    const rows = [{ ...op("a@x.com", "가운영", "active"), team: "운영1팀" }];
    expect(Object.keys(assignmentCandidates(rows)[0])).toEqual([
      "email",
      "name",
    ]);
  });

  it("빈 명부는 빈 후보다", () => {
    expect(assignmentCandidates([])).toEqual([]);
  });
});
