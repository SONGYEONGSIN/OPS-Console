import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackupForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "",
  name: "",
  status: "active",
  owner: "Bob",
  substituteEmail: "",
  substituteName: "",
  backupServices: [],
  backupServicesDetail: [],
  leaveStartDate: null,
  leaveEndDate: null,
  mailStatus: "pending",
  summary: "",
};

describe("BackupForm", () => {
  it("필드 입력 시 setRow 호출 (공통 메모)", () => {
    const setRow = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={setRow}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("공통 메모"), {
      target: { value: "내용" },
    });
    expect(setRow).toHaveBeenCalled();
  });

  it("저장 버튼 클릭 시 onSave(row) 호출", () => {
    const onSave = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 버튼 클릭 시 onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("PR-5: 기본 mode='single' — 상단 백업자 select 노출", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText("백업자")).toBeInTheDocument();
  });

  it("PR-6: row hydrate 시 서비스별로 다른 substitute_email → mode='perService' 자동 인식 (상단 백업자 select 부재)", () => {
    const rowWithPerService: ListRow = {
      ...baseRow,
      substituteEmail: "alice@example.com",
      substituteName: "Alice",
      backupServicesDetail: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          service_id: 1,
          service_name: "s1",
          university_name: "u1",
          substitute_email: "kim@example.com",
          substitute_name: "Kim",
          contacts: [],
          note_md: null,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          service_id: 2,
          service_name: "s2",
          university_name: "u2",
          substitute_email: "park@example.com",
          substitute_name: "Park",
          contacts: [],
          note_md: null,
        },
      ],
    };
    render(
      <BackupForm
        row={rowWithPerService}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    // perService 모드 → 상단 단일 백업자 select 부재
    expect(screen.queryByLabelText("백업자")).toBeNull();
    // '서비스별' 버튼이 활성 상태
    expect(screen.getByRole("button", { name: "서비스별" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("PR-5: '서비스별' 클릭 시 상단 백업자 select 부재", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "서비스별" }));
    expect(screen.queryByLabelText("백업자")).toBeNull();
  });

  it("PR-5: '서비스별' 모드 + 카드 백업자 명시 + 저장 → onSave에 parent.substituteEmail 자동 채움", () => {
    const onSave = vi.fn();
    const rowWithService = {
      ...baseRow,
      backupServices: ["11111111-1111-4111-8111-111111111111"],
      backupServicesDetail: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          service_id: 5072006,
          service_name: "신입학",
          university_name: "경찰대학",
          substitute_email: "kim@example.com",
          substitute_name: "Kim",
          contacts: [],
          note_md: null,
        },
      ],
    };
    render(
      <BackupForm
        row={rowWithService}
        setRow={() => {}}
        onSave={onSave}
        onCancel={() => {}}
        backupOperators={[{ email: "kim@example.com", name: "Kim" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "서비스별" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        substituteEmail: "kim@example.com",
        substituteName: "Kim",
      }),
    );
  });

  it("PR-5: '1명 일괄'로 다시 전환 → 상단 백업자 select 라벨 '백업자'", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "서비스별" }));
    fireEvent.click(screen.getByRole("button", { name: "1명 일괄" }));
    expect(screen.getByLabelText("백업자")).toBeInTheDocument();
  });

  it("백업자 select 변경 시 substituteEmail + substituteName 둘 다 설정", () => {
    const setRow = vi.fn();
    const operators = [
      { email: "alice@example.com", name: "Alice" },
      { email: "carol@example.com", name: "Carol" },
    ];
    render(
      <BackupForm
        row={baseRow}
        setRow={setRow}
        onSave={() => {}}
        onCancel={() => {}}
        backupOperators={operators}
      />,
    );
    fireEvent.change(screen.getByLabelText("백업자"), {
      target: { value: "alice@example.com" },
    });
    expect(setRow).toHaveBeenCalledWith(
      expect.objectContaining({
        substituteEmail: "alice@example.com",
        substituteName: "Alice",
      }),
    );
  });

  it("빈 backupOperators 시 placeholder만 노출", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        backupOperators={[]}
      />,
    );
    const select = screen.getByLabelText("백업자") as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toContain("선택");
  });

  it("PR-4: 일괄 대학 연락처 섹션 부재", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    // 기존 "대학 연락처 (0/20)" 일괄 input 사라짐. "대학 연락처"는 서비스 카드 내부에만 존재
    expect(screen.queryByText(/^대학 연락처 \(0\/20\)$/)).toBeNull();
  });

  it("PR-4: 서비스 검색·추가 → backupServicesDetail에 contacts:[]+note_md:null로 초기화된 detail 추가", () => {
    const setRow = vi.fn();
    const candidates = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        service_id: 5072006,
        service_name: "신입학",
        university_name: "경찰대학",
      },
    ];
    render(
      <BackupForm
        row={baseRow}
        setRow={setRow}
        onSave={() => {}}
        onCancel={() => {}}
        backupServiceCandidates={candidates}
      />,
    );
    fireEvent.change(screen.getByLabelText("백업 서비스 검색"), {
      target: { value: "경찰" },
    });
    fireEvent.click(screen.getByText("신입학"));
    const [[next]] = setRow.mock.calls;
    expect(next.backupServicesDetail).toHaveLength(1);
    expect(next.backupServicesDetail[0]).toMatchObject({
      id: candidates[0].id,
      service_name: "신입학",
      university_name: "경찰대학",
      contacts: [],
      note_md: null,
    });
  });

  it("PR-4: 서비스 카드 헤더 노출 (선택된 서비스만큼)", () => {
    render(
      <BackupForm
        row={{
          ...baseRow,
          backupServices: ["11111111-1111-4111-8111-111111111111"],
          backupServicesDetail: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              service_id: 5072006,
              service_name: "신입학",
              university_name: "경찰대학",
              contacts: [],
              note_md: null,
            },
          ],
        }}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("경찰대학 — 신입학")).toBeInTheDocument();
  });
});
