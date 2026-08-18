import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 지원한다 — 폴러가 실제로 쓰는 그 파일을 테스트한다.
import {
  resolveProposalPath,
  proposalFileName,
} from "../../../../scripts/assistant/propose-lib.mjs";

/**
 * 에이전트가 볼트에 쓰는 유일한 통로다. 여기가 뚫리면 볼트 전체가 열린다.
 *
 * 볼트 설계 §7이 `제안/` 격리를 정한 근거는 §8의 실측이다 — 에이전트가 쓴 문서
 * 10건 중 3건이 틀렸다. 근거가 코드에 다 있는 상태였는데도. 그래서 사람이 옮기기
 * 전까지는 본 위치에 닿으면 안 된다.
 *
 * 검증을 폴러(serve-local.mjs) 안에 묻으면 탈출 시도를 테스트할 수 없어 여기로 뺐다.
 */
import { resolve, sep } from "node:path";

/** 플랫폼 무관 비교 — Windows는 resolve가 드라이브 문자를 붙인다. */
const VAULT = resolve("/tmp/vault-test");
const inProposals = (p: string) => p.startsWith(resolve(VAULT, "제안") + sep);

describe("proposalFileName — 제목을 파일명으로", () => {
  it("평범한 제목은 그대로 쓴다", () => {
    expect(proposalFileName("부산대 수시 인수인계")).toBe(
      "부산대 수시 인수인계.md",
    );
  });

  it("경로 구분자가 있으면 **던진다**", () => {
    // 조용히 뭉개면(`a/b` → `ab.md`) 탈출 시도가 로그에도 안 남는다.
    // 프로젝트 규칙: 불가능한 상태는 조용히 넘기지 말고 던진다.
    expect(() => proposalFileName("a/b")).toThrow(/경로/);
    expect(() => proposalFileName("a\\b")).toThrow(/경로/);
  });

  it("상위 참조가 있으면 던진다", () => {
    expect(() => proposalFileName("..")).toThrow(/경로/);
    expect(() => proposalFileName("a..b")).toThrow(/경로/);
  });

  it("Windows 예약 문자는 지운다 — 경로를 못 만드는 문자다", () => {
    expect(proposalFileName('a:b*c?d"e<f>g|h')).toBe("abcdefgh.md");
  });

  it("앞뒤 공백을 지운다", () => {
    expect(proposalFileName("  부산대  ")).toBe("부산대.md");
  });

  it("남는 게 없으면 거부한다", () => {
    expect(() => proposalFileName("   ")).toThrow(/제목/);
    expect(() => proposalFileName(":*?")).toThrow(/제목/);
  });
});

describe("resolveProposalPath — 제안/ 밖으로 못 나간다", () => {
  it("정상 제목은 제안/ 아래를 가리킨다", () => {
    const p = resolveProposalPath(VAULT, "부산대 수시");
    expect(inProposals(p)).toBe(true);
    expect(p.endsWith("부산대 수시.md")).toBe(true);
  });

  it("상위 경로 탈출을 막는다", () => {
    expect(() => resolveProposalPath(VAULT, "../규칙/뚫림")).toThrow();
    expect(() => resolveProposalPath(VAULT, "../../etc/passwd")).toThrow();
  });

  it("절대경로를 막는다", () => {
    expect(() => resolveProposalPath(VAULT, "/etc/passwd")).toThrow();
    expect(() => resolveProposalPath(VAULT, "C:\\Windows\\x")).toThrow();
  });

  it("접두 위장이 제안/ 밖을 못 가리킨다 — 제안-x 는 파일명일 뿐", () => {
    // startsWith("제안") 로만 검사하면 `제안-x/`가 통과하는 자리다.
    const p = resolveProposalPath(VAULT, "제안-x");
    expect(inProposals(p)).toBe(true);
    expect(p.endsWith(`제안${sep}제안-x.md`)).toBe(true);
  });

  it("볼트 경로가 비면 거부한다", () => {
    expect(() => resolveProposalPath("", "x")).toThrow(/볼트/);
  });
});
