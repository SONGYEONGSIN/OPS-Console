import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModalShell } from "../ModalShell";

describe("ModalShell — 표준 모달 셸", () => {
  it("title을 헤더에, children을 본문에, footer를 렌더한다", () => {
    render(
      <ModalShell title="연락처 일괄등록" onClose={() => {}} footer={<button>확인</button>}>
        <p>본문 내용</p>
      </ModalShell>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("연락처 일괄등록")).toBeInTheDocument();
    expect(screen.getByText("본문 내용")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("boxed 닫기(×) 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <ModalShell title="t" onClose={onClose}>
        <p>b</p>
      </ModalShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc 키로 onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <ModalShell title="t" onClose={onClose}>
        <p>b</p>
      </ModalShell>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
