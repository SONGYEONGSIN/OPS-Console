import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevControlView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";
import type { DevControlAnalysis } from "@/features/dev-controls/schemas";

vi.mock("@/features/dev-controls/actions", () => ({
  updateDevControlFlag: vi.fn(async () => ({ ok: true })),
  requestDevControlAnalyze: vi.fn(async () => ({ ok: true })),
}));

import {
  updateDevControlFlag,
  requestDevControlAnalyze,
} from "@/features/dev-controls/actions";

function analysis(
  overrides: Partial<DevControlAnalysis> = {},
): DevControlAnalysis {
  return {
    id: "a1",
    service_id: 1001,
    file_name: "apply_A.asp",
    gen_flag: "Y",
    kind: "A",
    code_hash: "hash1",
    raw_code: "<% Response.Write('hello') %>",
    summary_md: "이 파일은 원서 접수 화면을 생성합니다.",
    flags: [
      {
        key: "hardcoded-date",
        label: "하드코딩된 마감일",
        snippet: "if now > #2025-01-01#",
        severity: "warn",
        checked: false,
        note: "",
      },
    ],
    analyzed_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function row(overrides: Partial<ListRow> = {}): ListRow {
  return {
    id: "s1",
    name: "원서접수",
    status: "active",
    owner: "",
    universityName: "조선대학교",
    serviceName: "수시모집",
    devControlAnalyses: [],
    ...overrides,
  } as ListRow;
}

describe("DevControlView", () => {
  it("요약 markdown 렌더 + A/AU 섹션 구분 표시", () => {
    const r = row({
      devControlAnalyses: [
        analysis({ id: "a1", kind: "A", file_name: "apply_A.asp" }),
        analysis({
          id: "a2",
          kind: "AU",
          file_name: "apply_AU.asp",
          summary_md: "이 파일은 개발자 전용 로직입니다.",
          flags: [],
        }),
      ],
    });
    render(<DevControlView row={r} />);

    expect(screen.getByText("apply_A.asp")).toBeInTheDocument();
    expect(screen.getByText("apply_AU.asp")).toBeInTheDocument();
    expect(screen.getByText("운영자 제어")).toBeInTheDocument();
    expect(screen.getByText("개발자 제어")).toBeInTheDocument();
    expect(
      screen.getByText("이 파일은 원서 접수 화면을 생성합니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("이 파일은 개발자 전용 로직입니다."),
    ).toBeInTheDocument();
  });

  it("미확인 flag: 체크박스 + 메모 input 렌더, 체크 시 updateDevControlFlag 호출", async () => {
    const r = row({ devControlAnalyses: [analysis()] });
    render(<DevControlView row={r} />);

    const checkbox = screen.getByLabelText(
      "하드코딩된 마감일",
    ) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);

    const noteInput = screen.getByLabelText("하드코딩된 마감일 메모");
    expect(noteInput).toBeInTheDocument();

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(updateDevControlFlag).toHaveBeenCalledWith({
        analysisId: "a1",
        flagKey: "hardcoded-date",
        checked: true,
        note: "",
      }),
    );
  });

  it("원본 코드 <details> 접힘 상태로 존재", () => {
    const r = row({ devControlAnalyses: [analysis()] });
    render(<DevControlView row={r} />);

    const summary = screen.getByText("원본 코드");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details?.hasAttribute("open")).toBe(false);
  });

  it("분석 없음 — 빈 상태 안내", () => {
    const r = row({ devControlAnalyses: [] });
    render(<DevControlView row={r} />);

    expect(screen.getByText("수집된 원서제어 없음")).toBeInTheDocument();
  });

  it("'지금 분석' 버튼 클릭 → requestDevControlAnalyze({ serviceId }) 호출", async () => {
    const r = row({ serviceIdNum: 1001, devControlAnalyses: [analysis()] });
    render(<DevControlView row={r} />);

    const btn = screen.getByRole("button", { name: "지금 분석" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);

    await waitFor(() =>
      expect(requestDevControlAnalyze).toHaveBeenCalledWith({
        serviceId: 1001,
      }),
    );
  });

  it("요청 pending → 버튼 disabled + '분석 대기' 배지", () => {
    const r = row({
      serviceIdNum: 1001,
      devControlAnalyses: [analysis()],
      devControlRequest: {
        id: "q1",
        service_id: 1001,
        requested_by: "송영신",
        status: "pending",
        requested_at: "2026-07-15T00:00:00Z",
        claimed_at: null,
        finished_at: null,
        message: null,
      },
    });
    render(<DevControlView row={r} />);

    expect(screen.getByRole("button", { name: "지금 분석" })).toBeDisabled();
    expect(screen.getByText("분석 대기")).toBeInTheDocument();
  });

  it("요청 running → 버튼 disabled + '분석 중' 배지", () => {
    const r = row({
      serviceIdNum: 1001,
      devControlAnalyses: [analysis()],
      devControlRequest: {
        id: "q1",
        service_id: 1001,
        requested_by: "송영신",
        status: "running",
        requested_at: "2026-07-15T00:00:00Z",
        claimed_at: "2026-07-15T00:05:00Z",
        finished_at: null,
        message: null,
      },
    });
    render(<DevControlView row={r} />);

    expect(screen.getByRole("button", { name: "지금 분석" })).toBeDisabled();
    expect(screen.getByText("분석 중")).toBeInTheDocument();
  });

  it("요청 failed → 버튼 활성 + message 노출", () => {
    const r = row({
      serviceIdNum: 1001,
      devControlAnalyses: [analysis()],
      devControlRequest: {
        id: "q1",
        service_id: 1001,
        requested_by: "송영신",
        status: "failed",
        requested_at: "2026-07-15T00:00:00Z",
        claimed_at: "2026-07-15T00:05:00Z",
        finished_at: "2026-07-15T00:07:00Z",
        message: "exit 1",
      },
    });
    render(<DevControlView row={r} />);

    expect(screen.getByRole("button", { name: "지금 분석" })).toBeEnabled();
    expect(screen.getByText(/exit 1/)).toBeInTheDocument();
  });
});

/**
 * 인스펙터 탭 — 원서제어 분석 / 학교 안내 명세.
 *
 * 명세를 분석 아래에 이어 붙였더니 분석 섹션이 여럿일 때 한참 스크롤해야 닿았다.
 * **독자가 다른 두 화면**이라 세로로 잇지 않고 나눈다(2026-09-04).
 */
describe("DevControlView — 탭", () => {
  const r = row({ serviceIdNum: 100, devControlAnalyses: [analysis()] });

  it("두 탭이 있다", () => {
    render(<DevControlView row={r} />);
    expect(screen.getByRole("tab", { name: /원서제어 분석/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /학교 안내/ })).toBeInTheDocument();
  });

  it("기본은 분석 — 운영자가 늘 먼저 보는 화면이다", () => {
    render(<DevControlView row={r} />);
    expect(screen.getByRole("tab", { name: /원서제어 분석/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText("학교 안내용 명세")).toBeNull();
  });

  it("명세 탭을 누르면 명세가 보이고 분석은 숨는다", () => {
    render(<DevControlView row={r} />);
    fireEvent.click(screen.getByRole("tab", { name: /학교 안내/ }));
    expect(screen.getByText(/뺄 항목은 체크를 끄세요/)).toBeInTheDocument();
    expect(screen.queryByText("원본 코드")).toBeNull();
  });

  it("분석이 없어도 탭은 있다 — 명세로 갈 길이 막히면 안 된다", () => {
    render(<DevControlView row={row({ serviceIdNum: 100 })} />);
    expect(screen.getByRole("tab", { name: /학교 안내/ })).toBeInTheDocument();
  });
});
