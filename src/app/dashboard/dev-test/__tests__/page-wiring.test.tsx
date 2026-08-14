import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/menu-guard", () => ({
  requireMenu: vi.fn(async () => undefined),
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(async () => ({
    email: "me@x.com",
    permission: "member",
    displayName: "송영신",
  })),
}));
vi.mock("@/features/entertest/queries", () => ({
  listTestableServices: vi.fn(async () => []),
  listEntertestRuns: vi.fn(async () => []),
  getMyEntertestAccount: vi.fn(async () => "jt29001"),
}));

import DevTestPage from "../page";
import { ListPattern } from "../../_components/patterns/ListPattern";

type Node = { type?: unknown; props?: { children?: unknown } };

/** 렌더된 엘리먼트 트리에서 해당 컴포넌트를 찾는다. */
function findByType(node: unknown, type: unknown): Node | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const el = node as Node;
  if (el.type === type) return el;
  return findByType(el.props?.children, type);
}

async function listPatternProps(): Promise<Record<string, unknown>> {
  const tree = await DevTestPage({
    searchParams: Promise.resolve({ tab: "test" }),
  });
  const el = findByType(tree, ListPattern);
  if (!el) throw new Error("ListPattern 엘리먼트를 찾지 못했습니다.");
  return (el.props ?? {}) as Record<string, unknown>;
}

/**
 * 인스펙터의 취소·삭제 버튼은 ViewProps의 currentUserEmail/Permission으로
 * '본인 요청인가'를 판정한다. 페이지가 이 값을 ListPattern에 넘기지 않으면
 * 컴포넌트 단위 테스트는 통과하는데 실제 화면에는 버튼이 안 뜬다.
 */
describe("DevTestPage — 인스펙터 권한 판정 배선", () => {
  it("로그인 운영자의 이메일을 ListPattern에 넘긴다", async () => {
    const props = await listPatternProps();
    expect(props.currentUserEmail).toBe("me@x.com");
  });

  it("로그인 운영자의 권한을 ListPattern에 넘긴다", async () => {
    const props = await listPatternProps();
    expect(props.currentUserPermission).toBe("member");
  });
});
