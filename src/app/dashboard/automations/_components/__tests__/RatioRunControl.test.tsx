import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const runRatio = vi.fn();
vi.mock("@/features/automations/actions", () => ({
  runRatioAuditAction: (prev: unknown, formData: FormData) =>
    runRatio(prev, formData),
}));

import type { AutomationStatus } from "@/features/automations/types";
import { RatioRunControl } from "../RatioRunControl";
import { RUN_COOLDOWN_CLASS, RUN_NOW_CLASS } from "../run-control-shared";

const ratio: AutomationStatus = {
  id: "ratio-audit",
  label: "경쟁률 세팅 점검",
  description: "d",
  scheduleInfo: "s",
  cadence: "manual",
  cooldownMinutes: 60,
  lastRunAt: null,
  cooldownRemainingMinutes: 0,
  enabled: false,
  localOnly: false,
  manualOnly: true,
  conditionForm: "ratio-audit",
};

function open(status: AutomationStatus = ratio) {
  render(<RatioRunControl status={status} isAdmin />);
  const name = status.cooldownRemainingMinutes > 0 ? /강제 실행/ : "지금 실행";
  fireEvent.click(screen.getByRole("button", { name }));
}

const runButton = (name = "실행") => screen.getByRole("button", { name });
const checkbox = (name: string) => screen.getByRole("checkbox", { name });

function submittedForm(): FormData {
  return runRatio.mock.calls[0][1] as FormData;
}

describe("RatioRunControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runRatio.mockResolvedValue({ ok: true, message: "요청을 적재했습니다." });
  });
  afterEach(() => vi.restoreAllMocks());

  it("지금 실행 → 아무것도 안 고른 창, 실행은 꺼져 있다", () => {
    open();
    expect(
      screen.getByRole("dialog", { name: "경쟁률 세팅 점검 — 실행 조건" }),
    ).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    boxes.forEach((box) => expect(box).not.toBeChecked());
    expect(runButton()).toBeDisabled();
  });

  it("두 묶음에서 하나씩 골라야 켜진다", () => {
    open();
    fireEvent.click(checkbox("2년제"));
    expect(runButton()).toBeDisabled();
    fireEvent.click(checkbox("수시"));
    expect(runButton()).toBeEnabled();
  });

  it("고른 값이 FormData 로 간다", async () => {
    open();
    fireEvent.click(checkbox("2년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    await waitFor(() => expect(runRatio).toHaveBeenCalledTimes(1));
    const form = submittedForm();
    expect(form.get("jobId")).toBe("ratio-audit");
    expect(form.getAll("univ")).toEqual(["2년제"]);
    expect(form.getAll("recruit")).toEqual(["수시"]);
    expect(form.get("force")).toBeNull();
  });

  it("기간은 고를 수 없고 '접수 마감 전'", () => {
    open();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByText(/기간: 접수 마감 전/)).toBeInTheDocument();
  });

  it("묶음은 fieldset·legend 이고 도움말과 안내가 있다", () => {
    open();
    expect(screen.getByRole("group", { name: "대학구분" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "모집구분" })).toBeInTheDocument();
    expect(
      screen.getByText("2년제는 전문대·폴리텍·전공대학을 함께 봅니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("정시는 가·나·다군을 모두 보고, 수시 재외국민은 빠집니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "실행하면 Moa 인증 문자가 1통 갑니다. 회사 PC 폴러가 5분 안에 시작합니다.",
      ),
    ).toBeInTheDocument();
  });

  it("쿨다운이면 강제 실행 — force=1", async () => {
    const cooling = { ...ratio, cooldownRemainingMinutes: 12 };
    render(<RatioRunControl status={cooling} isAdmin />);
    fireEvent.click(
      screen.getByRole("button", { name: "쿨다운 12분 — 강제 실행" }),
    );
    expect(
      screen.getByText(
        "최근 실행 후 쿨다운 12분이 남았습니다 — 실행하면 강제 실행됩니다.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(checkbox("4년제"));
    fireEvent.click(checkbox("정시"));
    fireEvent.click(runButton("강제 실행"));
    await waitFor(() => expect(runRatio).toHaveBeenCalledTimes(1));
    expect(submittedForm().get("force")).toBe("1");
  });

  it("쿨다운이 아니면 쿨다운 문구가 없다", () => {
    open();
    expect(screen.queryByText(/쿨다운/)).toBeNull();
  });

  it("성공하면 창이 닫히고 결과 문구", async () => {
    open();
    fireEvent.click(checkbox("4년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const message = screen.getByText("요청을 적재했습니다.");
    expect(message.className).toMatch(/text-ink/);
  });

  it("실패하면 창이 열린 채 이유와 고른 값 유지", async () => {
    runRatio.mockResolvedValue({ ok: false, message: "대상이 0건입니다." });
    open();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(checkbox("2년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    const alertBox = await screen.findByRole("alert");
    expect(alertBox).toHaveTextContent("대상이 0건입니다.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(checkbox("2년제")).toBeChecked();
    expect(checkbox("수시")).toBeChecked();
    expect(checkbox("4년제")).not.toBeChecked();
  });

  it("보내는 중이면 '요청 중…' 으로 잠긴다", async () => {
    // 끝내지 않는 Promise 는 React 의 액션 큐를 다음 테스트까지 물고 간다 — 직접 끝낸다
    let finish: (value: { ok: boolean; message: string }) => void = () => {};
    runRatio.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open();
    fireEvent.click(checkbox("4년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    expect(await screen.findByRole("button", { name: "요청 중…" })).toBeDisabled();
    finish({ ok: true, message: "끝" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("보내는 중에는 Esc·×·취소로 닫히지 않는다", async () => {
    let finish: (value: { ok: boolean; message: string }) => void = () => {};
    runRatio.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open();
    fireEvent.click(checkbox("4년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    await screen.findByRole("button", { name: "요청 중…" });
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" }).className).toMatch(
      /disabled:opacity-50/,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finish({ ok: true, message: "끝" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("쿨다운 트리거는 쿨다운 클래스", () => {
    render(
      <RatioRunControl
        status={{ ...ratio, cooldownRemainingMinutes: 12 }}
        isAdmin
      />,
    );
    expect(
      screen.getByRole("button", { name: "쿨다운 12분 — 강제 실행" }).className,
    ).toBe(RUN_COOLDOWN_CLASS);
  });

  it("닫았다 다시 열면 빈 상태", () => {
    open();
    fireEvent.click(checkbox("2년제"));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "지금 실행" }));
    screen
      .getAllByRole("checkbox")
      .forEach((box) => expect(box).not.toBeChecked());
  });

  it("실패 뒤 닫았다 다시 열면 이전 실패는 안 보인다", async () => {
    runRatio.mockResolvedValue({ ok: false, message: "대상이 0건입니다." });
    open();
    fireEvent.click(checkbox("2년제"));
    fireEvent.click(checkbox("수시"));
    fireEvent.click(runButton());
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "지금 실행" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("비admin 은 창 없이 알럿", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<RatioRunControl status={ratio} isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "지금 실행" }));
    expect(alertSpy).toHaveBeenCalledWith("관리자만 실행 가능합니다.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("모양 — 트리거는 다른 잡과 같은 클래스, 창 버튼은 표준 호버", () => {
    open();
    const trigger = screen.getByRole("button", { name: "지금 실행" });
    expect(trigger.className).toBe(RUN_NOW_CLASS);
    expect(trigger).toHaveAttribute("type", "button");
    expect(runButton().className).toMatch(/hover:bg-ink/);
    expect(runButton().className).toMatch(/hover:border-ink/);
    expect(screen.getByRole("button", { name: "취소" }).className).toMatch(
      /hover:bg-ink/,
    );
    expect(screen.getByRole("button", { name: "취소" }).className).toMatch(
      /hover:text-cream/,
    );
    expect(screen.getByRole("button", { name: "취소" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});
