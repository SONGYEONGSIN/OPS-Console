import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorPanel } from "../InspectorPanel";
import { ModalShell } from "@/components/common/ModalShell";

describe("InspectorPanel", () => {
  it("open=true — 패널 visible (translate-x-0)", () => {
    render(
      <InspectorPanel open={true} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("translate-x-0");
  });

  it("open=false — 패널 hidden (translate-x-full + aria-hidden)", () => {
    render(
      <InspectorPanel open={false} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    // open=false면 aria-hidden=true이므로 hidden:true 옵션 필요
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel.className).toContain("translate-x-full");
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("ESC 키 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("외부 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button>외부</button>
        <InspectorPanel open={true} onClose={onClose}>
          <p>내용</p>
        </InspectorPanel>
      </div>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "외부" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("#ops-modal-root(모달 오버레이) 내부 클릭은 외부 클릭으로 보지 않음 — onClose 미호출", () => {
    const onClose = vi.fn();
    // 앱에서는 DashboardShell이 렌더하는 모달 portal 마운트 지점.
    const modalRoot = document.createElement("div");
    modalRoot.id = "ops-modal-root";
    const modalChild = document.createElement("button");
    modalChild.textContent = "모달 내부 버튼";
    modalRoot.appendChild(modalChild);
    document.body.appendChild(modalRoot);

    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.mouseDown(modalChild);
    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(modalRoot);
  });
});

/**
 * 모바일에서 이 패널은 화면 전체 폭을 덮는다. 바깥 탭으로 닫히는 코드는 있지만
 * **바깥이 눈에 안 보여** 닫을 방법이 없어 보였다(2026-08-25 실사용 제보).
 *
 * 사이드바가 이미 쓰는 방식대로 딤을 깐다 — 닫을 수 있다는 게 보이고, 탭 대상도
 * 넓어진다. 패널 폭은 줄이지 않는다(내용이 좁아지는 게 더 나쁘다).
 */
describe("InspectorPanel — 모바일 딤 배경", () => {
  it("열려 있으면 딤이 나오고 누르면 닫힌다", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    const dim = screen.getByTestId("inspector-dim");
    fireEvent.click(dim);
    expect(onClose).toHaveBeenCalled();
  });

  it("딤은 모바일에서만 보인다 — 데스크톱은 옆에 붙는 패널이라 가릴 이유가 없다", () => {
    render(
      <InspectorPanel open={true} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    expect(screen.getByTestId("inspector-dim").className).toContain("md:hidden");
  });

  it("닫혀 있으면 딤이 탭을 먹지 않는다 — 안 보이는 층이 화면을 막으면 안 된다", () => {
    render(
      <InspectorPanel open={false} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>,
    );
    expect(screen.getByTestId("inspector-dim").className).toContain("pointer-events-none");
  });
});

/**
 * 인스펙터 안에서 연 모달(ModalShell)의 Esc 가 인스펙터까지 닫으면 신규 사고 작성 중이던
 * 내용이 사라진다. 'Esc 를 소비한 층이 표시한다' — 표시(defaultPrevented)된 Esc 는 무시한다.
 */
describe("InspectorPanel — 이미 소비된 Esc", () => {
  it("defaultPrevented 인 Escape 는 onClose 를 부르지 않는다", () => {
    const onClose = vi.fn();
    const consume = (e: KeyboardEvent) => e.preventDefault();
    document.addEventListener("keydown", consume);
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    document.removeEventListener("keydown", consume);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("일반 Escape 는 그대로 onClose 를 부른다", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("안에서 연 ModalShell 의 Esc 는 모달만 닫고 인스펙터는 그대로 둔다", () => {
    const onInspectorClose = vi.fn();
    const onModalClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onInspectorClose}>
        <ModalShell title="모달" onClose={onModalClose}>
          <p>모달 본문</p>
        </ModalShell>
      </InspectorPanel>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(onInspectorClose).not.toHaveBeenCalled();
  });
});
