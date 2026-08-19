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

/**
 * 영수증 원본처럼 세로로 긴 이미지를 볼 때는 xl(max-w-2xl)도 좁다.
 * 기존 4개는 그대로 두고 한 칸만 넓힌다 — 다른 모달에 영향이 없다.
 */
describe("ModalShell — a4 사이즈", () => {
  it("a4는 기존 xl보다 넓다", () => {
    const { container: a4 } = render(
      <ModalShell title="영수증" onClose={() => {}} size="a4">
        <p>본문</p>
      </ModalShell>,
    );
    expect(a4.querySelector(".max-w-3xl")).not.toBeNull();
  });

  it("기존 사이즈는 그대로다", () => {
    const { container } = render(
      <ModalShell title="t" onClose={() => {}} size="xl">
        <p>본문</p>
      </ModalShell>,
    );
    expect(container.querySelector(".max-w-2xl")).not.toBeNull();
  });
});
