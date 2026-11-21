import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { AllAreaNotes } from "../AllAreaNotes";

afterEach(cleanup);

describe("AllAreaNotes", () => {
  it("쓴 사람마다 이름과 금주·차주 — 빈 칸은 —", () => {
    render(
      <AllAreaNotes
        title="원서접수"
        notes={[
          { name: "김슬기", thisWeek: "연장 접수", nextWeek: "" },
          { name: "박시현", thisWeek: "", nextWeek: "점검 예정" },
        ]}
      />,
    );
    const region = screen.getByRole("region", { name: "원서접수 특이사항" });
    const first = within(region).getByText("김슬기").closest("article") as HTMLElement;
    expect(within(first).getByText("연장 접수")).toBeInTheDocument();
    expect(within(first).getByText("—")).toBeInTheDocument();
    expect(within(region).getByText("점검 예정")).toBeInTheDocument();
  });

  it("아무도 안 썼으면 한 줄", () => {
    render(<AllAreaNotes title="휴가·외근" notes={[]} />);
    expect(screen.getByText("작성한 특이사항이 없습니다")).toBeInTheDocument();
  });
});
