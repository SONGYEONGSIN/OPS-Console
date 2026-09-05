import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { saveSpy, result } = vi.hoisted(() => ({
  saveSpy: vi.fn(),
  result: { value: { ok: true, saved: 16 } as unknown },
}));

vi.mock("@/features/dev-controls/admission-type-actions", () => ({
  saveAdmissionTypes: (...a: unknown[]) => {
    saveSpy(...a);
    return Promise.resolve(result.value);
  },
}));

const { PasteAdmissionTypes } = await import("../PasteAdmissionTypes");

const CSV = [
  "수험번호,SelTypeCode,U코드,전형명",
  "1,5,1E,학생부교과(사회통합전형)",
  "2,5,1E,학생부교과(사회통합전형)",
  "3,15,1G,실기/실적(실기전형)",
].join("\n");

/**
 * 전형 이름표 붙여넣기.
 *
 * 원서제어 코드에 `SelTypeCode` 와 전형 이름이 이어진 자리가 없어 학교 명세서가
 * `전형 코드 5` 로만 적혔다. 대학 접수 현황 자료를 붙여넣어 채운다.
 */
describe("PasteAdmissionTypes", () => {
  beforeEach(() => {
    saveSpy.mockClear();
    result.value = { ok: true, saved: 16 };
  });

  it("열기 전에는 저장하지 않는다", () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  /** 붙여넣은 게 맞는지 눈으로 보고 저장해야 한다 — 엉뚱한 표를 넣으면 이름이 다 틀린다. */
  it("붙여넣으면 저장 전에 무엇이 들어갈지 보여준다", () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: CSV } });
    // 텍스트영역에도 같은 글자가 있으므로 미리보기 목록으로 좁힌다.
    const preview = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(preview.join("|")).toContain("학생부교과(사회통합전형)");
    expect(preview.join("|")).toContain("실기/실적(실기전형)");
  });

  it("같은 전형이 여러 줄이어도 한 줄로 접는다", () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: CSV } });
    expect(screen.getByText(/전형 2개/)).toBeInTheDocument();
  });

  it("머리글이 틀리면 무엇이 빠졌는지 말한다", () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "가,나\n1,2" },
    });
    // 도움말에도 SelTypeCode 가 있으므로 오류 색으로 좁힌다.
    const err = document.querySelector(".text-vermilion");
    expect(err?.textContent).toMatch(/SelTypeCode/);
  });

  it("저장을 누르면 접은 결과를 보낸다", async () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: CSV } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(saveSpy).toHaveBeenCalledWith(1130058, [
      { selTypeCode: 5, univCode: "1E", name: "학생부교과(사회통합전형)" },
      { selTypeCode: 15, univCode: "1G", name: "실기/실적(실기전형)" },
    ]);
  });

  it("실패하면 사유를 그대로 보여준다", async () => {
    result.value = { ok: false, error: "admin만 저장할 수 있습니다" };
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: CSV } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText(/admin만 저장할 수 있습니다/)).toBeInTheDocument();
  });

  /** 개인정보가 든 표를 통째로 붙여넣게 되므로 무엇을 안 읽는지 말해 준다. */
  it("개인정보는 읽지 않는다고 알린다", () => {
    render(<PasteAdmissionTypes serviceId={1130058} />);
    fireEvent.click(screen.getByRole("button", { name: /전형 이름표/ }));
    // 문장이 <b> 로 잘려 있어 노드 하나로는 안 잡힌다 — 모달 전체 텍스트로 본다.
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/수험번호.*아이디.*읽지 않습니다/);
  });
});
