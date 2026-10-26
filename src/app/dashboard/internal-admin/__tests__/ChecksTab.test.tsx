import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=checks");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

import type { CheckItem } from "@/features/sms-sender/types";
import { ChecksTab } from "../_components/ChecksTab";

const item = (no: number, over: Partial<CheckItem> = {}): CheckItem => ({
  no,
  kind: "번호 불일치",
  target: "가나대학교\n02-0000-0001",
  content: "시트와 서류의 번호가 다릅니다",
  basis: "신청서 2쪽",
  todo: "서류 재확인",
  schoolNo: 1,
  ...over,
});

const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

const renderTab = (rows: CheckItem[], total = rows.length, kind = "") =>
  render(
    <ChecksTab
      rows={rows}
      total={total}
      kind={kind}
      kindOptions={["번호 불일치", "이름 미대조"]}
    />,
  );

describe("ChecksTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=checks");
  });

  it("머리글과 건수", () => {
    renderTab([item(1)], 23);
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["유형", "대상", "내용", "근거", "할 일"]);
    expect(screen.getByText("확인 필요 23건")).toBeInTheDocument();
  });

  it("학교로 이어지는 대상은 링크", () => {
    renderTab([item(1)]);
    const link = screen.getByRole("link", { name: "가나대학교" });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/internal-admin?tab=schools&school=1",
    );
    const cell = link.closest("td")!;
    expect(within(cell).getByText("02-0000-0001").className).toContain(
      "whitespace-pre-line",
    );
    expect(cell.contains(within(cell).getByText("02-0000-0001"))).toBe(true);
    expect(link.textContent).not.toContain("02-0000-0001");
  });

  it("이어지지 않는 대상은 줄바꿈 보존 텍스트", () => {
    renderTab([item(2, { schoolNo: null, target: "미상 학교\n둘째 줄" })]);
    expect(screen.queryByRole("link")).toBeNull();
    const el = screen.getByText(/미상 학교/);
    expect(el.className).toContain("whitespace-pre-line");
    expect(el.textContent).toBe("미상 학교\n둘째 줄");
  });

  it("유형 select → ?type", () => {
    renderTab([item(1)]);
    const select = screen.getByLabelText("유형 필터");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["유형 전체", "번호 불일치", "이름 미대조"]);
    fireEvent.change(select, { target: { value: "이름 미대조" } });
    expect(lastQuery().get("type")).toBe("이름 미대조");
  });
});
