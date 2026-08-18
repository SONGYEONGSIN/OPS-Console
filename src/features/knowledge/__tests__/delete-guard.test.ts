import { describe, it, expect } from "vitest";
import { assertDeletableProposal } from "../delete-guard";

/**
 * 볼트 삭제는 **`제안/`에만** 연다.
 *
 * 열람 화면은 설계상 읽기 전용이다 — 원본이 파일이라 웹에서 지우면 OneDrive 동기를
 * 타고 사라지고 되돌릴 방법이 화면에 없다. 그래서 사람이 쓴 문서는 계속 옵시디언에서
 * 지운다. 다만 **에이전트 초안은 화면에서 치울 길이 없어 쌓이기만 했다**
 * (2026-08-18: 제안 2건이 쌓여 사용자가 삭제 방법을 물었다).
 */
describe("assertDeletableProposal", () => {
  it("제안 폴더 문서는 지울 수 있다", () => {
    expect(() =>
      assertDeletableProposal("제안/부산대학교 수시 서비스 세팅.md"),
    ).not.toThrow();
  });

  it("본 위치 문서는 거부한다 — 사람이 쓴 지식이다", () => {
    expect(() => assertDeletableProposal("엔티티/부산대.md")).toThrow(/제안/);
    expect(() => assertDeletableProposal("플레이북/경위서 발송 절차.md")).toThrow();
  });

  it("접두 위장을 막는다 — 제안-x/ 는 제안/ 이 아니다", () => {
    expect(() => assertDeletableProposal("제안-x/y.md")).toThrow();
    expect(() => assertDeletableProposal("제안x/y.md")).toThrow();
  });

  it("상위 경로 탈출을 막는다", () => {
    expect(() => assertDeletableProposal("제안/../엔티티/x.md")).toThrow();
    expect(() => assertDeletableProposal("../제안/x.md")).toThrow();
  });

  it("마크다운이 아니면 거부한다", () => {
    expect(() => assertDeletableProposal("제안/x.txt")).toThrow(/\.md/);
  });

  it("빈 경로를 거부한다", () => {
    expect(() => assertDeletableProposal("")).toThrow();
  });
});
