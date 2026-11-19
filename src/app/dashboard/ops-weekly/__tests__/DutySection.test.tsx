import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
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

describe("DutySection", () => {
  it("머리와 주 라벨, 지금 당번이 고른 값으로 보인다", () => {
    renderDuty();
    const h = screen.getByRole("heading", { name: "당번 지정" });
    expect(h.tagName).toBe("H2");
    expect(h.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xl", "font-bold"]),
    );
    expect(screen.getByText("11월 3주 · 11.16 ~ 11.22")).toBeInTheDocument();
    expect(screen.getByLabelText("당번")).toHaveValue("운영자A");
  });

  it("열린 주: 당번을 고르면 setWeekDuty 를 부르고 새로 읽는다", async () => {
    renderDuty();
    fireEvent.change(screen.getByLabelText("당번"), {
      target: { value: "운영자B" },
    });
    await waitFor(() =>
      expect(setWeekDuty).toHaveBeenCalledWith({
        weekId: "w1",
        dutyEmail: "b@x",
      }),
    );
    expect(setWeekDuty).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("보고된 주: 고를 수 없고 이유를 적는다", () => {
    renderDuty({ week: { ...WEEK, status: "reported" } });
    expect(screen.queryByLabelText("당번")).toBeNull();
    expect(screen.getByText("운영자A")).toBeInTheDocument();
    expect(
      screen.getByText("보고가 끝난 주는 당번을 바꿀 수 없습니다"),
    ).toBeInTheDocument();
  });

  it("관리자가 아니면 열린 주여도 고를 수 없다 — 당번이 없으면 미지정", () => {
    renderDuty({
      actor: { email: "d@x", isAdmin: false },
      week: { ...WEEK, duty_email: null },
    });
    expect(screen.queryByLabelText("당번")).toBeNull();
    expect(screen.getByText("미지정")).toBeInTheDocument();
  });

  it("보고된 주: 명단 밖 당번은 미지정이 아니라 이메일로 보인다", () => {
    renderDuty({ week: { ...WEEK, status: "reported", duty_email: "x@x" } });
    expect(screen.getByText("x@x")).toBeInTheDocument();
    expect(screen.queryByText("미지정")).toBeNull();
  });

  it("열린 주: 명단 밖 당번이면 고르는 상자 옆에 한 줄을 붙인다", () => {
    renderDuty({ week: { ...WEEK, duty_email: "X@X" } });
    const picker = screen.getByLabelText("당번");
    const note = screen.getByText("지금 당번 x@x — 명단 밖");
    expect(note.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xs", "text-ink-soft"]),
    );
    expect(note.closest("div")).toBe(picker.closest("div.flex-wrap"));
  });

  it("열린 주: 명단 안 당번이거나 당번이 없으면 그 줄이 없다", () => {
    const { unmount } = renderDuty();
    expect(screen.queryByText(/명단 밖/)).toBeNull();
    unmount();
    renderDuty({ week: { ...WEEK, duty_email: null } });
    expect(screen.queryByText(/명단 밖/)).toBeNull();
  });
});
