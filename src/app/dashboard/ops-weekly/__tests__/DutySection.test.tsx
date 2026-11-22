import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const setWeekDuty = vi.fn();
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  setWeekDuty: (...a: unknown[]) => setWeekDuty(...a),
}));

import type { ComponentProps } from "react";
import { DutySection } from "../_components/DutySection";

const cand = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const WEEK = { id: "w1", status: "open" as const, duty_email: "a@x" };

function renderDuty(props: Partial<ComponentProps<typeof DutySection>> = {}) {
  return render(
    <DutySection
      week={WEEK}
      weekLabel="11월 3주 · 11.16 ~ 11.22"
      writers={[cand("a@x", "운영자A"), cand("b@x", "운영자B")]}
      actor={{ email: "z@x", isAdmin: true }}
      {...props}
    />,
  );
}

beforeEach(() => {
  refresh.mockReset();
  setWeekDuty.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const rowOf = (name: string) =>
  screen.getByText(name).closest("tr") as HTMLElement;

describe("DutySection", () => {
  it("머리와 주 라벨, 작성자 표 — 지금 당번 행에 당번 표시", () => {
    renderDuty();
    const h = screen.getByRole("heading", { name: "당번 지정" });
    expect(h.tagName).toBe("H2");
    expect(h.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xl", "font-bold"]),
    );
    expect(screen.getByText("11월 3주 · 11.16 ~ 11.22")).toBeInTheDocument();
    // 지금 당번은 주 라벨 옆 — 같은 줄
    const line = screen.getByText("11월 3주 · 11.16 ~ 11.22").parentElement as HTMLElement;
    expect(line.tagName).not.toBe("SECTION");
    expect(line.className.split(/\s+/)).toContain("flex");
    expect(screen.getByText(/^지금 당번:/).parentElement).toBe(line);
    expect(screen.getByRole("table")).toBeInTheDocument();
    const onA = within(rowOf("운영자A")).getByRole("button", { name: "ON" });
    expect(onA).toHaveAttribute("aria-pressed", "true");
    // 당번은 비울 수 없다 — 다른 사람을 켜면 넘어간다
    expect(
      within(rowOf("운영자A")).getByRole("button", { name: "OFF" }),
    ).toBeDisabled();
  });

  it("열린 주: 다른 행을 ON 하면 setWeekDuty 를 부르고 새로 읽는다", async () => {
    renderDuty();
    fireEvent.click(within(rowOf("운영자B")).getByRole("button", { name: "ON" }));
    await waitFor(() =>
      expect(setWeekDuty).toHaveBeenCalledWith({
        weekId: "w1",
        dutyEmail: "b@x",
      }),
    );
    expect(setWeekDuty).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("보고된 주: 토글이 잠기고 이유를 적는다", () => {
    renderDuty({ week: { ...WEEK, status: "reported" } });
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    expect(
      within(rowOf("운영자A")).getByRole("button", { name: "ON" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("보고가 끝난 주는 당번을 바꿀 수 없습니다"),
    ).toBeInTheDocument();
  });

  it("관리자가 아니면 열린 주여도 토글이 잠긴다", () => {
    renderDuty({
      actor: { email: "d@x", isAdmin: false },
      week: { ...WEEK, duty_email: null },
    });
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });

  it("당번이 없으면 미지정이라 적는다", () => {
    renderDuty({ week: { ...WEEK, duty_email: null } });
    expect(screen.getByText("지금 당번: 미지정")).toBeInTheDocument();
  });

  it("명단 밖 당번은 미지정이 아니라 이메일과 함께 적는다", () => {
    renderDuty({ week: { ...WEEK, duty_email: "X@X" } });
    expect(screen.getByText("지금 당번: x@x — 명단 밖")).toBeInTheDocument();
    expect(screen.queryByText(/미지정/)).toBeNull();
  });
});
