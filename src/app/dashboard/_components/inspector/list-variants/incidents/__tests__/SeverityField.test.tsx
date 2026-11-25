import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SeverityCriteria } from "@/features/incidents/schemas";

vi.mock("@/features/incidents/severity-criteria-actions", () => ({
  updateSeverityCriteria: vi.fn(),
}));

import { SeverityField } from "../SeverityField";

// 테스트 fixture — 실제 기준 문구의 원천은 마이그레이션 seed 하나다.
const CRITERIA: SeverityCriteria = {
  심각: "기준-심각",
  높음: "기준-높음",
  보통: "기준-보통",
  낮음: "기준-낮음",
};

function renderField(
  props: Partial<React.ComponentProps<typeof SeverityField>> = {},
) {
  const onChange = vi.fn();
  render(
    <SeverityField
      value={undefined}
      onChange={onChange}
      required={false}
      criteria={CRITERIA}
      canEditCriteria={false}
      {...props}
    />,
  );
  return { onChange };
}

function optionTexts(select: HTMLElement): string[] {
  return Array.from((select as HTMLSelectElement).options).map(
    (o) => o.textContent ?? "",
  );
}

describe("SeverityField — 선택·필수·오류 (T9)", () => {
  it("값이 비면 '등급 선택'(disabled) + 4값이다", () => {
    renderField();
    const select = screen.getByLabelText("사고 등급") as HTMLSelectElement;
    expect(optionTexts(select)).toEqual([
      "등급 선택",
      "심각",
      "높음",
      "보통",
      "낮음",
    ]);
    expect(select.options[0].disabled).toBe(true);
    expect(select.value).toBe("");
  });

  it("값이 있으면 '등급 선택' 이 없다 — 설정한 등급은 다시 비우지 못한다", () => {
    renderField({ value: "보통" });
    const select = screen.getByLabelText("사고 등급") as HTMLSelectElement;
    expect(optionTexts(select)).toEqual(["심각", "높음", "보통", "낮음"]);
    expect(select.value).toBe("보통");
  });

  it("고르면 onChange 에 그 등급이 간다", () => {
    const { onChange } = renderField();
    fireEvent.change(screen.getByLabelText("사고 등급"), {
      target: { value: "높음" },
    });
    expect(onChange).toHaveBeenCalledWith("높음");
  });

  it("(필수) 는 required 일 때만 보인다", () => {
    const { unmount } = render(
      <SeverityField
        value={undefined}
        onChange={vi.fn()}
        required
        criteria={CRITERIA}
        canEditCriteria={false}
      />,
    );
    expect(screen.getByText("(필수)").className).toContain("text-faint");
    unmount();
    renderField({ required: false });
    expect(screen.queryByText("(필수)")).toBeNull();
  });

  it("error 가 있으면 role=alert 문구 + aria-invalid", () => {
    renderField({ error: "사고 등급을 선택하세요." });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("사고 등급을 선택하세요.");
    expect(alert.className).toContain("text-vermilion");
    expect(
      screen.getByLabelText("사고 등급").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("error 가 없으면 alert 도 aria-invalid 도 없다", () => {
    renderField();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("사고 등급").getAttribute("aria-invalid"),
    ).toBeNull();
  });

  it("select 는 입력 표준 모양이다", () => {
    renderField();
    const cls = screen.getByLabelText("사고 등급").className;
    for (const c of [
      "border-line-soft",
      "bg-field-bg",
      "focus:border-ink",
      "focus:bg-white",
    ]) {
      expect(cls).toContain(c);
    }
  });
});

describe("SeverityField — ? 툴팁 (T10)", () => {
  it("? 버튼의 aria-describedby 가 툴팁 id 다", () => {
    renderField();
    const help = screen.getByRole("button", { name: "사고 등급 기준 보기" });
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.id).not.toBe("");
    expect(help.getAttribute("aria-describedby")).toBe(tip.id);
    expect(help.getAttribute("type")).toBe("button");
  });

  it("툴팁에 4개 등급 이름과 받은 설명이 모두 있다", () => {
    renderField();
    const tip = screen.getByRole("tooltip", { hidden: true });
    for (const name of ["심각", "높음", "보통", "낮음"] as const) {
      expect(tip.textContent).toContain(name);
      expect(tip.textContent).toContain(CRITERIA[name]);
    }
  });

  it("빈 설명은 — 로 쓴다", () => {
    renderField({ criteria: { ...CRITERIA, 낮음: "" } });
    const tip = screen.getByRole("tooltip", { hidden: true });
    const dds = Array.from(tip.querySelectorAll("dd")).map(
      (d) => d.textContent,
    );
    expect(dds).toEqual(["기준-심각", "기준-높음", "기준-보통", "—"]);
  });

  it("툴팁은 hover·포커스로 열리고 포인터를 올려도 닫히지 않는다", () => {
    renderField();
    const cls = screen.getByRole("tooltip", { hidden: true }).className;
    expect(cls).toContain("hidden");
    expect(cls).toContain("group-hover:block");
    expect(cls).toContain("group-focus-within:block");
    expect(cls).not.toContain("pointer-events-none");
  });

  it("? 는 버튼 호버 표준이다", () => {
    renderField();
    const cls = screen.getByRole("button", {
      name: "사고 등급 기준 보기",
    }).className;
    expect(cls).toContain("hover:border-ink");
    expect(cls).toContain("hover:bg-ink");
    expect(cls).toContain("hover:text-cream");
  });

  it("criteria=null 이면 '기준을 불러오지 못했습니다.'", () => {
    renderField({ criteria: null });
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.textContent).toBe("기준을 불러오지 못했습니다.");
  });

  it("? 에서 Escape 를 누르면 포커스가 풀려 툴팁이 닫힌다", () => {
    renderField();
    const help = screen.getByRole("button", { name: "사고 등급 기준 보기" });
    help.focus();
    expect(document.activeElement).toBe(help);
    fireEvent.keyDown(help, { key: "Escape" });
    expect(document.activeElement).not.toBe(help);
  });
});

describe("SeverityField — admin 편집 진입 (T12)", () => {
  const EDIT = { name: "사고 등급 기준 편집" } as const;

  it("canEditCriteria=false 면 톱니 버튼이 없다", () => {
    renderField({ canEditCriteria: false });
    expect(screen.queryByRole("button", EDIT)).toBeNull();
  });

  it("admin 이라도 criteria=null 이면 톱니 버튼이 없다", () => {
    renderField({ canEditCriteria: true, criteria: null });
    expect(screen.queryByRole("button", EDIT)).toBeNull();
  });

  it("admin + criteria 면 ? 바로 옆 톱니 버튼 — 누르면 기준 편집 모달", () => {
    renderField({ canEditCriteria: true });
    const gear = screen.getByRole("button", EDIT);
    expect(gear.getAttribute("type")).toBe("button");
    expect(gear.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(gear);
    expect(
      screen.getByRole("dialog", { name: "사고 등급 기준 편집" }),
    ).toBeTruthy();
  });

  it("톱니는 ? 와 같은 h-4 w-4 상자 + 버튼 호버 표준이고 멀리 보내지 않는다", () => {
    renderField({ canEditCriteria: true });
    const gear = screen.getByRole("button", EDIT);
    for (const c of [
      "h-4",
      "w-4",
      "hover:border-ink",
      "hover:bg-ink",
      "hover:text-cream",
    ]) {
      expect(gear.className).toContain(c);
    }
    expect(gear.className).not.toContain("ml-auto");
    const help = screen.getByRole("button", { name: "사고 등급 기준 보기" });
    // ? 그룹 바로 다음 형제가 톱니다.
    expect(help.parentElement?.nextElementSibling).toBe(gear);
  });

  it("모달을 닫으면 사라진다", () => {
    renderField({ canEditCriteria: true });
    fireEvent.click(screen.getByRole("button", EDIT));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
