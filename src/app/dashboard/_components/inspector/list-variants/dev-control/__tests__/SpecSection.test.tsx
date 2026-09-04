import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpecSection } from "../SpecSection";
import type { DevControlSpec } from "@/features/dev-control-specs/schemas";

const toggle = vi.fn(async () => ({ ok: true }));
const request = vi.fn(async () => ({ ok: true }));
const send = vi.fn(async () => ({ ok: true }));

vi.mock("@/features/dev-control-specs/actions", () => ({
  toggleDevControlSpecItem: (...a: unknown[]) => toggle(...(a as [])),
  requestDevControlSpec: (...a: unknown[]) => request(...(a as [])),
  sendDevControlSpec: (...a: unknown[]) => send(...(a as [])),
}));

const spec: DevControlSpec = {
  id: "s1",
  service_id: 9045010,
  items: [
    { key: "period", title: "접수 기간", body: "9월 7일부터", included: true },
    { key: "pay", title: "결제 마감", body: "2시간 전", included: false },
  ],
  source_analyzed_at: "2026-09-01T02:00:00Z",
  generated_at: "2026-09-04T02:00:00Z",
};

const recipients = [
  { email: "a@univ.ac.kr", name: "김담당", department: "입학처" },
];

function view(over: Partial<Parameters<typeof SpecSection>[0]> = {}) {
  return render(
    <SpecSection
      serviceId={9045010}
      spec={spec}
      recipients={recipients}
      hasAnalyses
      {...over}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("SpecSection", () => {
  it("제외한 항목도 화면에는 남는다 — 무엇을 뺐는지 보여야 다시 판단한다", () => {
    view();
    expect(screen.getByText("결제 마감")).toBeInTheDocument();
  });

  it("몇 건이 나가는지 알려준다", () => {
    view();
    expect(screen.getByText(/2건 중 1건/)).toBeInTheDocument();
  });

  it("체크를 끄면 저장한다", async () => {
    view();
    fireEvent.click(screen.getByLabelText("접수 기간 안내에 포함"));
    await waitFor(() => expect(toggle).toHaveBeenCalled());
    expect(toggle).toHaveBeenCalledWith(
      expect.objectContaining({ itemKey: "period", included: false }),
    );
  });

  it("코드를 걷어 온 날짜를 적는다 — 학교에는 이게 신뢰다", () => {
    view();
    expect(screen.getByText(/2026.*09.*01.*기준/)).toBeInTheDocument();
  });

  it("분석이 없으면 만들 수 없다", () => {
    view({ hasAnalyses: false, spec: undefined });
    expect(screen.getByRole("button", { name: /명세서 만들기/ })).toBeDisabled();
    expect(screen.getByText(/먼저 \[지금 분석\]/)).toBeInTheDocument();
  });

  it("수신자를 안 고르면 발송할 수 없다", () => {
    view();
    expect(screen.getByRole("button", { name: "발송" })).toBeDisabled();
  });

  it("수신자를 고르면 발송할 수 있다", async () => {
    view();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a@univ.ac.kr" } });
    expect(screen.getByRole("button", { name: "발송" })).toBeEnabled();
  });

  it("포함 항목이 하나도 없으면 못 보낸다", async () => {
    const none = {
      ...spec,
      items: spec.items.map((i) => ({ ...i, included: false })),
    };
    view({ spec: none });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a@univ.ac.kr" } });
    expect(screen.getByRole("button", { name: "발송" })).toBeDisabled();
  });

  it("연락처가 없으면 이유를 알려준다 — 빈 목록만 두면 왜 못 보내는지 모른다", () => {
    view({ recipients: [] });
    expect(screen.getByText(/연락처가 없습니다/)).toBeInTheDocument();
  });

  it("본문을 폼으로 넘기지 않는다 — 서버가 DB 에서 다시 만든다", async () => {
    view();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a@univ.ac.kr" } });
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send).toHaveBeenCalledWith(
      expect.not.objectContaining({ body: expect.anything() }),
    );
  });
});

/**
 * 요청 상태가 화면에 보여야 한다.
 *
 * 안 보이면 눌러 놓고 **되고 있는지 알 수 없다** — 실제로 실패했는데 화면은
 * 그대로였고, 사용자가 "작동 되고 있는건가"라고 물었다(2026-09-04).
 */
describe("SpecSection — 요청 상태", () => {
  const req = (status: string, message?: string) => ({
    id: "r1",
    service_id: 9045010,
    kind: "spec",
    requested_by: "나",
    status,
    requested_at: "2026-09-04T08:00:00Z",
    claimed_at: null,
    finished_at: null,
    message: message ?? null,
  });

  it("대기 중이면 알려준다", () => {
    view({ request: req("pending") as never });
    expect(screen.getByText(/대기/)).toBeInTheDocument();
  });

  it("진행 중이면 알려준다", () => {
    view({ request: req("running") as never });
    expect(screen.getByText(/만드는 중|진행/)).toBeInTheDocument();
  });

  it("대기·진행 중에는 다시 누를 수 없다", () => {
    view({ request: req("running") as never });
    expect(screen.getByRole("button", { name: /다시 만들기/ })).toBeDisabled();
  });

  it("실패하면 이유를 보여준다 — exit 1 만으로는 손쓸 수 없다", () => {
    view({ request: req("failed", "spec exit 1 — ETIMEDOUT") as never });
    expect(screen.getByText(/ETIMEDOUT/)).toBeInTheDocument();
  });

  it("실패했으면 다시 누를 수 있다", () => {
    view({ request: req("failed", "오류") as never });
    expect(screen.getByRole("button", { name: /다시 만들기/ })).toBeEnabled();
  });

  it("분석 요청 중일 때는 명세 상태로 오해하지 않는다", () => {
    // 같은 큐를 kind 로 나눠 쓰므로, 분석 요청이 명세 '진행 중'으로 보이면 안 된다.
    view({ request: { ...req("running"), kind: "analyze" } as never });
    expect(screen.queryByText(/만드는 중/)).toBeNull();
  });
});
