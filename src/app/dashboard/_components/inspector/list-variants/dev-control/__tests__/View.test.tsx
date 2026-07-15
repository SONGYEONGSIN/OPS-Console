import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevControlView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";
import type { DevControlAnalysis } from "@/features/dev-controls/schemas";

vi.mock("@/features/dev-controls/actions", () => ({
  updateDevControlFlag: vi.fn(async () => ({ ok: true })),
}));

import { updateDevControlFlag } from "@/features/dev-controls/actions";

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
});
