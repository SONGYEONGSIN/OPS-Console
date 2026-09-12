import { describe, it, expect, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/menu-guard", () => ({
  requireMenu: vi.fn(async () => undefined),
}));

const getCurrentOperator: Mock = vi.fn(async () => ({
  email: "me@x.com",
  permission: "member",
  displayName: "송영신",
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: (...a: unknown[]) => getCurrentOperator(...a),
}));

const listAiTips: Mock = vi.fn(async () => []);
vi.mock("@/features/ai-tips/queries", () => ({
  listAiTips: (...a: unknown[]) => listAiTips(...a),
}));

const listCandidates: Mock = vi.fn(async () => []);
vi.mock("@/features/ai-tip-candidates/queries", () => ({
  listCandidates: (...a: unknown[]) => listCandidates(...a),
}));

import AiTipsPage from "../page";
import { TipCandidateSection } from "../_components/TipCandidateSection";
import { ListPattern } from "../../_components/patterns/ListPattern";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { PageTabs } from "@/components/common/PageTabs";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

type Node = { type?: unknown; props?: Record<string, unknown> };

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

function candidate(over: Partial<AiTipCandidateRow> = {}): AiTipCandidateRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    repo_full_name: "acme/agent-kit",
    repo_url: "https://github.com/acme/agent-kit",
    stars: 350,
    repo_description: "에이전트 워크플로 도구",
    draft_title: "에이전트 워크플로 자동화",
    draft_summary_md: "요약",
    draft_reuse_prompt: "프롬프트",
    draft_tags: ["자동화"],
    draft_ai_tool: "claude",
    draft_category: "automation",
    status: "pending",
    collected_at: "2026-08-11T00:00:00Z",
    ...over,
  };
}

async function renderPage(
  sp: Record<string, string> = {},
  candidates: AiTipCandidateRow[] = [],
) {
  listCandidates.mockResolvedValue(candidates);
  return AiTipsPage({ searchParams: Promise.resolve(sp) } as never);
}

describe("AiTipsPage — 탭 배선", () => {
  it("기본 탭은 등록된 TIP — 파라미터 없는 기존 주소가 그대로 산다", async () => {
    const tree = await renderPage();
    expect(findByType(tree, ListPattern)?.props?.variant).toBe("ai-tips");
    expect(findByType(tree, TipCandidateSection)).toBeNull();
  });

  it("?tab=candidates 면 후보 섹션을 그린다", async () => {
    const tree = await renderPage({ tab: "candidates" }, [candidate()]);
    expect(findByType(tree, TipCandidateSection)).not.toBeNull();
    expect(findByType(tree, ListPattern)).toBeNull();
  });

  it("공용 PageTabs 로 탭 둘을 그린다 — 기본 탭 주소에는 파라미터가 없다", async () => {
    const tabs = findByType(await renderPage(), PageTabs);
    expect(tabs?.props?.active).toBe("tips");
    expect(tabs?.props?.tabs).toEqual([
      { key: "tips", label: "등록된 TIP", href: "/dashboard/ai-tips" },
      {
        key: "candidates",
        label: "TIP 후보",
        href: "/dashboard/ai-tips?tab=candidates",
      },
    ]);
  });

  it("후보가 0건이어도 탭은 보인다 — 숨김·등록됨을 보러 들어가야 한다", async () => {
    expect(findByType(await renderPage({}, []), PageTabs)).not.toBeNull();
  });

  it("후보 전건을 섹션에 넘긴다 — 검토 대기만 넘기면 숨김을 되돌릴 수 없다", async () => {
    const all = [
      candidate({ status: "pending" }),
      candidate({ id: "22222222-2222-4222-8222-222222222222", status: "hidden" }),
      candidate({
        id: "33333333-3333-4333-8333-333333333333",
        status: "promoted",
      }),
    ];
    const tree = await renderPage({ tab: "candidates" }, all);
    expect(
      findByType(tree, TipCandidateSection)?.props?.candidates,
    ).toHaveLength(3);
  });

  it("헤더 건수는 활성 탭 건수다 — 후보 탭에서는 지금 칸의 후보 수", async () => {
    const all = [
      candidate({ status: "pending" }),
      candidate({ id: "22222222-2222-4222-8222-222222222222", status: "pending" }),
      candidate({
        id: "33333333-3333-4333-8333-333333333333",
        status: "hidden",
      }),
    ];
    const tree = await renderPage({ tab: "candidates" }, all);
    const meta = findByType(tree, PageHeader)?.props?.meta as {
      label: string;
    }[];
    expect(meta.map((m) => m.label)).toContain("2건");
  });

  it("viewer 는 결정 권한이 없다", async () => {
    getCurrentOperator.mockResolvedValueOnce({
      email: "v@x.com",
      permission: "viewer",
      displayName: "열람",
    });
    const tree = await renderPage({ tab: "candidates" }, [candidate()]);
    expect(findByType(tree, TipCandidateSection)?.props?.canDecide).toBe(false);
  });
});
