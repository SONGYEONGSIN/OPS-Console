import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FillForm } from "../FillForm";
import type { ChecklistItem } from "@/features/checklist/schemas";

const fillUpdateItem = vi.fn(async (_t: string, _i: string, _p: unknown) => ({
  ok: true,
}));
const fillAddItem = vi.fn(
  async (_t: string, _d: string, _c: string, _ti: string) => ({
    ok: true,
    id: "new",
  }),
);
const fillDeleteItem = vi.fn(async (_t: string, _i: string) => ({ ok: true }));
vi.mock("@/features/checklist/fill-actions", () => ({
  fillUpdateItem: (t: string, i: string, p: unknown) => fillUpdateItem(t, i, p),
  fillAddItem: (t: string, d: string, c: string, ti: string) =>
    fillAddItem(t, d, c, ti),
  fillDeleteItem: (t: string, i: string) => fillDeleteItem(t, i),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const items: ChecklistItem[] = [
  {
    id: "i1",
    roundId: "R1",
    department: "기획파트",
    category: "사이트(PC/M)",
    title: "광고배너 노출",
    status: null,
    note: "",
    sortOrder: 0,
    attachments: [],
  },
  {
    id: "i2",
    roundId: "R1",
    department: "개발부",
    category: "서버/시스템",
    title: "웹 서버 확인",
    status: null,
    note: "",
    sortOrder: 0,
    attachments: [],
  },
];

beforeEach(() => fillUpdateItem.mockClear());

describe("FillForm (전 부서 통합 작성)", () => {
  it("모든 부서·항목을 렌더한다", () => {
    render(
      <FillForm
        token="tok"
        roundTitle="2027 수시"
        periodStart={null}
        periodEnd={null}
        items={items}
      />,
    );
    expect(screen.getByText("2027 수시")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "기획" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "개발" })).toBeInTheDocument();
    expect(screen.getByText("광고배너 노출")).toBeInTheDocument();
    expect(screen.getByText("웹 서버 확인")).toBeInTheDocument();
  });

  it("상태 칩 클릭 → fillUpdateItem(token, itemId, {status})", () => {
    render(
      <FillForm
        token="tok"
        roundTitle="R"
        periodStart={null}
        periodEnd={null}
        items={[items[0]]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(fillUpdateItem).toHaveBeenCalledWith("tok", "i1", {
      status: "done",
    });
  });

  it("메모는 리치 에디터(contentEditable 멀티라인)로 렌더", () => {
    render(
      <FillForm
        token="tok"
        roundTitle="R"
        periodStart={null}
        periodEnd={null}
        items={[items[0]]}
      />,
    );
    const memo = screen.getByRole("textbox");
    expect(memo).toHaveAttribute("contenteditable", "true");
    expect(memo).toHaveAttribute("aria-multiline", "true");
  });

  it("빈 항목이면 안내 문구", () => {
    render(
      <FillForm
        token="tok"
        roundTitle="R"
        periodStart={null}
        periodEnd={null}
        items={[]}
      />,
    );
    expect(screen.getByText(/항목이 없습니다/)).toBeInTheDocument();
  });
});
