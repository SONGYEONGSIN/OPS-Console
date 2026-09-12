import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ServicesView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "2026 수시 원서접수",
  status: "active",
  owner: "박운영",
  serviceIdNum: 1234567,
  applicationType: "공통원서",
  region: "서울",
  universityName: "○○대학교",
  serviceName: "2026 수시 원서접수",
  universityType: "4년제",
  category: "수시",
  operatorEmail: "op1@example.com",
  operatorName: "박운영",
  developerEmail: "dev1@example.com",
  developerName: "김개발",
  writeStartAt: "2026-08-01T00:00:00Z",
  writeEndAt: "2026-09-15T00:00:00Z",
  payStartAt: "2026-08-01T00:00:00Z",
  payEndAt: "2026-09-15T00:00:00Z",
  solo: false,
  source: "google_sheet_import",
  importedAt: "2026-05-13T00:00:00Z",
};

describe("ServicesView", () => {
  it("핵심 필드 표시 — service_id / 대학명 / 서비스명 / 카테고리 / 접수구분 / 지역 / 대학구분", () => {
    render(<ServicesView row={baseRow} />);
    expect(screen.getByText("1234567")).toBeInTheDocument();
    expect(screen.getByText("○○대학교")).toBeInTheDocument();
    expect(screen.getByText("2026 수시 원서접수")).toBeInTheDocument();
    expect(screen.getByText("수시")).toBeInTheDocument();
    expect(screen.getByText("공통원서")).toBeInTheDocument();
    expect(screen.getByText("서울")).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
  });

  it("운영자/개발자 표시", () => {
    render(<ServicesView row={baseRow} />);
    expect(screen.getByText(/박운영/)).toBeInTheDocument();
    expect(screen.getByText(/김개발/)).toBeInTheDocument();
  });

  it("단독여부 — 단독일 때 '단독' 배지 표시", () => {
    render(<ServicesView row={{ ...baseRow, solo: true }} />);
    expect(screen.getByText("단독")).toBeInTheDocument();
  });

  it("단독여부 — 단독이 아니면 '듀얼' 이다", () => {
    render(<ServicesView row={{ ...baseRow, solo: false }} />);
    expect(screen.getByText("듀얼")).toBeInTheDocument();
    expect(screen.queryByText("공동")).not.toBeInTheDocument();
  });

  it("source 표시 (google_sheet_import / folio_create)", () => {
    render(<ServicesView row={baseRow} />);
    expect(screen.getByText(/google_sheet_import/)).toBeInTheDocument();
  });

  it("operator_email null — 이름 fallback 또는 '-' 표시", () => {
    render(
      <ServicesView
        row={{ ...baseRow, operatorEmail: null, operatorName: null }}
      />,
    );
    // operator 영역에 '-' 또는 '미지정' 표기 (운영자 매칭 실패 케이스)
    const operatorTerm = screen.getByText("운영자");
    expect(operatorTerm).toBeInTheDocument();
  });
});

/**
 * 숫자는 기본 폰트 + `tabular-nums` 다. `font-mono` 는 문자가 섞인 값 전용 —
 * UUID·경로·명령어처럼 한 글자씩 눈으로 짚는 것들이다.
 *
 * 등기번호를 mono 에서 뺐을 때와 같은 판단이다(2026-08-20) — 자릿수 대조는
 * `tabular-nums` 가 하고, 숫자만 다른 글꼴이면 그 칸이 혼자 튄다.
 */
describe("ServicesView — 숫자 표기", () => {
  it("service_id 는 기본 폰트에 tabular-nums 다", () => {
    render(<ServicesView row={baseRow} />);
    const el = screen.getByText("1234567");
    expect(el.className).toContain("tabular-nums");
    expect(el.className).not.toContain("font-mono");
  });

  it("source 는 font-mono 를 유지한다 — 문자가 섞인 기계값이다", () => {
    render(<ServicesView row={baseRow} />);
    expect(screen.getByText("google_sheet_import").className).toContain("font-mono");
  });
});

/**
 * `solo` 는 Moa 엑셀 '단독여부'(Y/N) 를 그대로 받은 boolean 이다 —
 * Y 는 `단독`, N 은 `듀얼` 로 부른다. `공동` 은 쓰지 않는 말이라
 * 화면에서 지웠고, 소스에 다시 들어오지 않는지 여기서 본다.
 *
 * (`공동작업자` 는 ai-work variant 의 무관한 단어다. 이 검사는 services
 *  variant 의 두 파일만 읽으므로 그쪽을 잡지 않는다.)
 */
describe("services variant 소스 — '공동' 표기 잔존 금지", () => {
  const DIR = "src/app/dashboard/_components/inspector/list-variants/services";

  it.each(["View.tsx", "Table.tsx"])("%s 에 '공동' 이 없다", (file) => {
    const src = readFileSync(join(process.cwd(), DIR, file), "utf8");
    expect(src).not.toContain("공동");
  });
});
