import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SeverityCriteria } from "@/features/incidents/schemas";

const updateSeverityCriteria = vi.fn();
vi.mock("@/features/incidents/severity-criteria-actions", () => ({
  updateSeverityCriteria: (input: unknown) => updateSeverityCriteria(input),
}));

import { SeverityCriteriaEditor } from "../SeverityCriteriaEditor";

// 테스트 fixture — 실제 기준 문구의 원천은 마이그레이션 seed 하나다.
const CRITERIA: SeverityCriteria = {
  심각: "기준-심각",
  높음: "기준-높음",
  보통: "기준-보통",
  낮음: "기준-낮음",
};

beforeEach(() => {
  updateSeverityCriteria.mockReset();
});

describe("SeverityCriteriaEditor (T11)", () => {
  it("사고 등급 기준 편집 모달에 textarea 4개 — 라벨은 등급 이름, 값은 현재 문구", () => {
    render(<SeverityCriteriaEditor criteria={CRITERIA} onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "사고 등급 기준 편집" }),
    ).toBeTruthy();
    for (const name of ["심각", "높음", "보통", "낮음"] as const) {
      const ta = screen.getByLabelText(name) as HTMLTextAreaElement;
      expect(ta.tagName).toBe("TEXTAREA");
      expect(ta.value).toBe(CRITERIA[name]);
      expect(ta.maxLength).toBe(500);
      for (const c of [
        "border-line-soft",
        "bg-field-bg",
        "focus:border-ink",
        "focus:bg-white",
      ]) {
        expect(ta.className).toContain(c);
      }
    }
  });

  it("하나를 고쳐 저장하면 고친 값을 포함한 전체 맵으로 호출하고, ok 면 닫는다", async () => {
    updateSeverityCriteria.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    render(<SeverityCriteriaEditor criteria={CRITERIA} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("높음"), {
      target: { value: "새 기준" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateSeverityCriteria).toHaveBeenCalledWith({
      ...CRITERIA,
      높음: "새 기준",
    });
  });

  it("실패면 모달 안에 오류 문구를 띄우고 닫지 않는다", async () => {
    updateSeverityCriteria.mockResolvedValue({
      ok: false,
      error: "관리자만 기준을 고칠 수 있습니다.",
    });
    const onClose = vi.fn();
    render(<SeverityCriteriaEditor criteria={CRITERIA} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("관리자만 기준을 고칠 수 있습니다.");
    expect(alert.className).toContain("text-vermilion");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("취소를 누르면 저장 없이 닫는다", () => {
    const onClose = vi.fn();
    render(<SeverityCriteriaEditor criteria={CRITERIA} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateSeverityCriteria).not.toHaveBeenCalled();
  });

  it("저장 중에는 저장 버튼이 잠긴다", async () => {
    let resolve: (v: { ok: true }) => void = () => {};
    updateSeverityCriteria.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<SeverityCriteriaEditor criteria={CRITERIA} onClose={vi.fn()} />);
    const save = screen.getByRole("button", { name: "저장" });
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveProperty("disabled", true));
    resolve({ ok: true });
    await waitFor(() => expect(save).toHaveProperty("disabled", false));
  });

  it("바깥 폼 안에서 렌더돼도 저장·취소가 폼을 제출하지 않는다 — EditForm <form> 안에 뜬다", async () => {
    updateSeverityCriteria.mockResolvedValue({ ok: true });
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onClose = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <SeverityCriteriaEditor criteria={CRITERIA} onClose={onClose} />
      </form>,
    );
    const save = screen.getByRole("button", { name: "저장" });
    const cancel = screen.getByRole("button", { name: "취소" });
    expect(save.getAttribute("type")).toBe("button");
    expect(cancel.getAttribute("type")).toBe("button");
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    fireEvent.click(cancel);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
