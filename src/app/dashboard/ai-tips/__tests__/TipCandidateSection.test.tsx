import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TipCandidateSection } from "../_components/TipCandidateSection";
import { CandidateScopeChips } from "../_components/CandidateScopeChips";
import { ListPattern } from "../../_components/patterns/ListPattern";
import type { ListRow } from "../../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

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

const MIXED: AiTipCandidateRow[] = [
  candidate({ id: "11111111-1111-4111-8111-111111111111", status: "pending" }),
  candidate({ id: "22222222-2222-4222-8222-222222222222", status: "pending" }),
  candidate({ id: "33333333-3333-4333-8333-333333333333", status: "hidden" }),
  candidate({ id: "44444444-4444-4444-8444-444444444444", status: "promoted" }),
];

function sectionProps(over: Record<string, unknown> = {}) {
  const tree = TipCandidateSection({
    candidates: MIXED,
    canDecide: true,
    ...over,
  } as never);
  const el = findByType(tree, ListPattern);
  if (!el) throw new Error("ListPattern 엘리먼트를 찾지 못했습니다.");
  return (el.props ?? {}) as Record<string, unknown>;
}

function rowsOf(over: Record<string, unknown> = {}): ListRow[] {
  const data = sectionProps(over).data as { rows: ListRow[] };
  return data.rows;
}

describe("TipCandidateSection", () => {
  it("scope 가 없으면 검토 대기만 보여준다 — 평소 볼 것은 아직 결정 안 한 후보다", () => {
    const rows = rowsOf();
    expect(rows.map((r) => r.tipCandidateStatus)).toEqual([
      "pending",
      "pending",
    ]);
  });

  it("scope=hidden 이면 숨긴 후보만 보여준다 — 되돌리러 오는 자리다", () => {
    const rows = rowsOf({ scope: "hidden" });
    expect(rows).toHaveLength(1);
    expect(rows[0].tipCandidateStatus).toBe("hidden");
  });

  it("scope=promoted 이면 등록된 후보만 보여준다", () => {
    const rows = rowsOf({ scope: "promoted" });
    expect(rows).toHaveLength(1);
    expect(rows[0].tipCandidateStatus).toBe("promoted");
  });

  it("모르는 scope 는 기본(검토 대기)으로 떨어진다 — 주소를 고쳐도 빈 화면이 안 된다", () => {
    expect(rowsOf({ scope: "zzz" })).toHaveLength(2);
  });

  it("칩 건수는 전건 기준이다 — 걸러진 뒤를 세면 언제나 0/0 이 된다", () => {
    const chips = findByType(
      sectionProps({ scope: "hidden" }).inlineFilters,
      CandidateScopeChips,
    );
    expect(chips?.props).toMatchObject({
      counts: { pending: 2, hidden: 1, promoted: 1 },
    });
  });

  it("페이지네이션 total 은 지금 칸의 건수다", () => {
    const pagination = findByType(
      sectionProps({ scope: "hidden" }).footer,
      ListPagination,
    );
    expect(pagination?.props).toMatchObject({ total: 1 });
  });

  it("읽기 전용 실데이터 목록이다 — 후보는 화면에서 만들지 않는다", () => {
    const props = sectionProps();
    expect(props.variant).toBe("ai-tip-candidates");
    expect(props.readOnly).toBe(true);
    expect(props.liveData).toBe(true);
  });

  it("결정 권한을 행마다 실어 보낸다 — 인스펙터가 버튼을 가리는 근거다", () => {
    expect(rowsOf({ canDecide: false })[0].tipCandidateCanDecide).toBe(false);
    expect(rowsOf({ canDecide: true })[0].tipCandidateCanDecide).toBe(true);
  });

  it("후보가 0건이어도 목록을 그린다 — 빈 화면이라도 칩으로 다른 칸에 간다", () => {
    const props = sectionProps({ candidates: [] });
    expect((props.data as { rows: ListRow[] }).rows).toEqual([]);
  });
});
