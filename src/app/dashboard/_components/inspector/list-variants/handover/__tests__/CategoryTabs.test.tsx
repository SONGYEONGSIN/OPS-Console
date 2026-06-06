import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CategoryTabs } from "../CategoryTabs";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "s1",
  name: "조선대 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "조선대학교",
  serviceName: "수시모집",
};

describe("CategoryTabs", () => {
  it("모든 카테고리를 탭 버튼으로 렌더 + 활성 탭 강조", () => {
    render(<CategoryTabs active="contract" onChange={() => {}} row={row} />);
    expect(screen.getByRole("button", { name: "계약" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "작업" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정산" })).toBeInTheDocument();
    // 활성 탭은 aria-current
    expect(screen.getByRole("button", { name: "계약" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("탭 클릭 시 onChange(key) 호출", () => {
    const onChange = vi.fn();
    render(<CategoryTabs active="contract" onChange={onChange} row={row} />);
    fireEvent.click(screen.getByRole("button", { name: "작업" }));
    expect(onChange).toHaveBeenCalledWith("work");
  });

  it("작성 진행 배터리 — 채운 카테고리는 '작성 완료', 빈 카테고리는 '미작성' (title)", () => {
    render(
      <CategoryTabs
        active="contract"
        onChange={() => {}}
        row={{
          ...row,
          handoverContractInfo: {
            title: "원서접수",
            type: "",
            progress: "",
            status: "",
            memo: "",
          },
          handoverContractChecklist: [{ id: "a", text: "계약서", done: false }],
        }}
      />,
    );
    // 계약: 2/2 → 작성 완료
    expect(
      within(screen.getByRole("button", { name: "계약" })).getByTitle(
        "작성 완료",
      ),
    ).toBeInTheDocument();
    // 기타: 0/1 → 미작성
    expect(
      within(screen.getByRole("button", { name: "기타" })).getByTitle(
        "미작성",
      ),
    ).toBeInTheDocument();
  });
});
