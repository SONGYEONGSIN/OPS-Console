import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { parseSmsSender } from "@/features/sms-sender/parse";
import {
  rawSource,
  numberRow,
  pdf,
  NUMBER_HEADER,
  CHECK_HEADER,
  checkRow,
} from "@/features/sms-sender/__tests__/fixtures";
import { schoolDetail, type SchoolDetail } from "@/features/sms-sender/filters";
import { SchoolInspector } from "../_components/SchoolInspector";

const detailOf = (over: Parameters<typeof rawSource>[0] = {}, no = 1) => {
  const d = schoolDetail(parseSmsSender(rawSource(over)), no);
  if (!d) throw new Error("detail 없음");
  return d;
};

describe("SchoolInspector", () => {
  it("서류 8종과 미제출 사유", () => {
    render(<SchoolInspector detail={detailOf()} onClose={() => {}} />);
    for (const k of [
      "신청서",
      "위임장",
      "이용증명원",
      "사업자등록증",
      "법인인감",
      "재직증명서",
      "신분증",
      "위탁계약서",
    ]) {
      expect(screen.getByText(k)).toBeInTheDocument();
    }
    expect(screen.getByText("미제출: 신분증")).toBeInTheDocument();
  });

  it("사본 둘이면 PDF 링크 둘", () => {
    const detail = detailOf({
      pdfs: [
        pdf("완료/제출완료/접수", "가나대학교"),
        pdf("완료/검토완료", "가나대학교"),
      ],
    });
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    const a = screen.getByRole("link", { name: "통합 PDF 열기 · 접수" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("link", { name: "통합 PDF 열기 · 검토완료" }),
    ).toBeInTheDocument();
  });

  it("발신번호 10줄 + 전체 보기 링크", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      numberRow(
        i + 1,
        "가나대학교",
        `02-0000-${String(i + 1).padStart(4, "0")}`,
      ),
    );
    const base = rawSource();
    const detail = detailOf({
      sheets: { ...base.sheets, numbers: [NUMBER_HEADER, ...rows] },
    });
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    expect(screen.getAllByText(/^02-0000-\d{4}$/)).toHaveLength(10);
    const link = screen.getByRole("link", {
      name: "발신번호 탭에서 전체 보기 (12)",
    });
    expect(link).toHaveAttribute(
      "href",
      `/dashboard/internal-admin?tab=numbers&q=${encodeURIComponent("가나대학교")}&gubun=${encodeURIComponent("4년제")}`,
    );
  });

  it("확인 항목 — 없으면 문구", () => {
    render(<SchoolInspector detail={detailOf({}, 2)} onClose={() => {}} />);
    expect(
      screen.getByText("이 학교의 확인 필요 항목이 없습니다"),
    ).toBeInTheDocument();
  });

  it("확인 항목이 있으면 유형과 할 일", () => {
    const base = rawSource();
    const detail = detailOf({
      sheets: {
        ...base.sheets,
        checks: [
          CHECK_HEADER,
          checkRow(1, "번호 확인", "가나대학교\n02-0000-0001"),
        ],
      },
    });
    expect(detail.checks).toHaveLength(1);
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    expect(screen.getByText("번호 확인")).toBeInTheDocument();
    expect(screen.getByText(/할 일/)).toBeInTheDocument();
  });

  it("PDF·서류 줄이 없을 때", () => {
    const d = detailOf({ pdfs: [] });
    const detail: SchoolDetail = { ...d, school: { ...d.school, docs: null } };
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    expect(screen.getByText("통합 PDF 없음")).toBeInTheDocument();
    expect(
      screen.getByText("_서류 시트에 이 학교 줄이 없습니다"),
    ).toBeInTheDocument();
  });

  it("detail null 이면 아무 내용도 없다", () => {
    render(<SchoolInspector detail={null} onClose={() => {}} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("닫기 → onClose (Escape, 닫기 버튼)", () => {
    const onClose = vi.fn();
    render(<SchoolInspector detail={detailOf()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
