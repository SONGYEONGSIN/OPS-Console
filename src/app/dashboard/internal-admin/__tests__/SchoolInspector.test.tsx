import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

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
    const shown = screen.getAllByText(/^02-0000-\d{4}$/);
    expect(shown).toHaveLength(10);
    for (const n of shown) {
      expect(n.className).toContain("tabular-nums");
      expect(n.className).not.toContain("font-mono");
    }
    const link = screen.getByRole("link", {
      name: "발신번호 탭에서 전체 보기 (12)",
    });
    // 기본이 전체라 mine 을 안 붙인다 — 남의 학교 인스펙터에서 눌러도 빈 목록이 아니다.
    expect(link).toHaveAttribute(
      "href",
      `/dashboard/internal-admin?tab=sms&view=numbers&q=${encodeURIComponent("가나대학교")}&gubun=${encodeURIComponent("4년제")}`,
    );
    expect(link).toHaveAttribute("data-next-link");
    expect(link.className).toContain("underline");
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

  it("서류 표시는 글자로 — 제출·미제출 칩·대체 인정·-·알 수 없음(원문)", () => {
    const d = detailOf();
    const docs = d.school.docs!;
    const detail: SchoolDetail = {
      ...d,
      school: {
        ...d.school,
        docs: {
          ...docs,
          marks: {
            ...docs.marks,
            법인인감: "대체",
            위임장: "X",
            재직증명서: "",
          },
        },
      },
    };
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    const ok = screen.getByLabelText("신청서 제출");
    expect(ok).toHaveTextContent(/^제출$/);
    expect(ok.className).toContain("text-ink");
    const miss = screen.getByLabelText("신분증 미제출");
    expect(miss).toHaveTextContent(/^미제출$/);
    for (const c of [
      "border",
      "border-vermilion",
      "px-1.5",
      "text-xs",
      "text-vermilion",
    ]) {
      expect(miss.className.split(/\s+/)).toContain(c);
    }
    const sub = screen.getByLabelText("법인인감 대체 인정");
    expect(sub).toHaveTextContent(/^대체 인정$/);
    expect(sub.className).toContain("text-muted");
    // 모르는 표시를 대체·제출로 뒤집지 않는다 — 원문을 그대로 보인다.
    const odd = screen.getByLabelText("위임장 알 수 없음(X)");
    expect(odd).toHaveTextContent(/^알 수 없음\(X\)$/);
    expect(odd.className).toContain("text-muted");
    const blank = screen.getByLabelText("재직증명서 표시 없음");
    expect(blank).toHaveTextContent(/^-$/);
    expect(blank.className).toContain("text-muted");
    // O·✕ 글자는 더 없다.
    expect(screen.queryByText("O")).toBeNull();
    expect(screen.queryByText("✕")).toBeNull();
  });

  it("섹션마다 상자 — 표면 표준, 제목 오른쪽에 건수(tabular-nums)", () => {
    const base = rawSource();
    const detail = detailOf({
      sheets: {
        ...base.sheets,
        numbers: [
          NUMBER_HEADER,
          numberRow(1, "가나대학교", "02-0000-0001"),
          numberRow(2, "가나대학교", "02-0000-0002"),
          numberRow(3, "가나대학교", "02-0000-0003"),
        ],
        checks: [
          CHECK_HEADER,
          checkRow(1, "번호 확인", "가나대학교\n02-0000-0001"),
        ],
      },
    });
    render(<SchoolInspector detail={detail} onClose={() => {}} />);
    const box = (title: string) =>
      screen
        .getByRole("heading", { name: title, level: 4 })
        .closest("section")!;
    const sections = ["제출 서류", "통합 PDF", "발신번호", "확인 필요"].map(
      box,
    );
    for (const s of sections) {
      for (const c of [
        "border",
        "border-line-soft",
        "bg-situation-bg",
        "p-4",
      ]) {
        expect(s.className.split(/\s+/)).toContain(c);
      }
    }
    // 상자 사이는 띄운다.
    const stack = sections[0].parentElement!;
    expect(sections.every((s) => s.parentElement === stack)).toBe(true);
    expect(stack.className).toMatch(/space-y-\d/);

    const countOf = (s: HTMLElement) => s.querySelector("[data-count]");
    const docs = countOf(sections[0])!;
    expect(docs).toHaveTextContent(/^7\/8$/);
    expect(docs.className).toContain("tabular-nums");
    expect(countOf(sections[1])).toBeNull();
    expect(countOf(sections[2])).toHaveTextContent(/^3$/);
    expect(countOf(sections[2])!.className).toContain("tabular-nums");
    expect(countOf(sections[3])).toHaveTextContent(/^1$/);
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

  it("닫기 → onClose (Escape) — 다른 인스펙터처럼 자체 닫기 버튼은 없다", () => {
    const onClose = vi.fn();
    render(<SchoolInspector detail={detailOf()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
  });

  it("머리는 표준 인스펙터 머리 — 눈썹 문구·text-xl 제목·굵은 아랫선", () => {
    render(<SchoolInspector detail={detailOf()} onClose={() => {}} />);
    const title = screen.getByRole("heading", { name: "가나대학교", level: 3 });
    expect(title.className).toContain("text-xl");
    expect(title.className).toContain("font-bold");
    const header = title.closest("header")!;
    expect(header.className).toContain("border-b-2");
    expect(header.className).toContain("border-ink");
    const eyebrow = screen.getByText("인스펙터 · 학교");
    expect(eyebrow.className).toContain("text-vermilion");
    expect(header.contains(eyebrow)).toBe(true);
    expect(header.textContent).toContain("4년제");
  });
});
