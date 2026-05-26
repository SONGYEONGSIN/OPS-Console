import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServiceCard, type ServiceCardDetail } from "../ServiceCard";

const baseDetail: ServiceCardDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 5072006,
  service_name: "신입학",
  university_name: "경찰대학",
  substitute_email: null,
  substitute_name: null,
  contacts: [],
  note_md: null,
};

const operators = [
  { email: "kim@example.com", name: "Kim" },
  { email: "park@example.com", name: "Park" },
];

// PR-5: contactCandidates에 email/phone 필드 추가 — 메일 발송 시 객체 스냅샷 빌드
const contactCandidates = [
  {
    id: "c1",
    customer_name: "양라윤",
    university_name: "한양대학교",
    email: "yry@hanyang.ac.kr",
    phone: "010-1111-2222",
  },
  {
    id: "c2",
    customer_name: "박지호",
    university_name: "연세대학교",
    email: null,
    phone: null,
  },
];

describe("ServiceCard", () => {
  it("헤더에 대학명 — 서비스명 표시", () => {
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("경찰대학 — 신입학")).toBeInTheDocument();
  });

  it("백업자 select 변경 → onSubstituteChange 호출 (email + name)", () => {
    const onSub = vi.fn();
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={onSub}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("신입학 백업자") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "kim@example.com" } });
    expect(onSub).toHaveBeenCalledWith("kim@example.com", "Kim");
  });

  it("백업자 select 비움 → onSubstituteChange(null, null)", () => {
    const onSub = vi.fn();
    render(
      <ServiceCard
        detail={{
          ...baseDetail,
          substitute_email: "kim@example.com",
          substitute_name: "Kim",
        }}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={onSub}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("신입학 백업자") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onSub).toHaveBeenCalledWith(null, null);
  });

  it("× 클릭 → onRemove 호출", () => {
    const onRem = vi.fn();
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={onRem}
      />,
    );
    fireEvent.click(screen.getByLabelText("신입학 제거"));
    expect(onRem).toHaveBeenCalledOnce();
  });

  it("연락처 검색 후 click → onContactsChange 호출 (chip 라벨 추가)", () => {
    const onContacts = vi.fn();
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={onContacts}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const search = screen.getByLabelText(
      "신입학 대학 연락처 검색",
    ) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "양라윤" } });
    fireEvent.click(screen.getByText("양라윤"));
    // PR-5: 객체 스냅샷 형태로 추가
    expect(onContacts).toHaveBeenCalledWith([
      {
        contact_id: "c1",
        customer_name: "양라윤",
        university_name: "한양대학교",
        email: "yry@hanyang.ac.kr",
        phone: "010-1111-2222",
      },
    ]);
  });

  it("기존 chip × 클릭 → onContactsChange 호출 (해당 항목 제거)", () => {
    const onContacts = vi.fn();
    const c1 = {
      contact_id: "c1",
      customer_name: "양라윤",
      university_name: "한양대학교",
      email: null,
      phone: null,
    };
    const c2 = {
      contact_id: "c2",
      customer_name: "박지호",
      university_name: "연세대학교",
      email: null,
      phone: null,
    };
    render(
      <ServiceCard
        detail={{ ...baseDetail, contacts: [c1, c2] }}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={onContacts}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("한양대학교 — 양라윤 제거"));
    expect(onContacts).toHaveBeenCalledWith([c2]);
  });

  it("이미 추가된 연락처는 검색 결과에서 제외", () => {
    const c1 = {
      contact_id: "c1",
      customer_name: "양라윤",
      university_name: "한양대학교",
      email: null,
      phone: null,
    };
    render(
      <ServiceCard
        detail={{ ...baseDetail, contacts: [c1] }}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const search = screen.getByLabelText(
      "신입학 대학 연락처 검색",
    ) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "양라윤" } });
    // 검색 dropdown에는 양라윤이 없어야 함 (이미 chip에 있음)
    const dropdownItems = screen.queryAllByText("양라윤");
    // chip 영역만 1개 — dropdown 결과 0개
    expect(dropdownItems).toHaveLength(0);
  });

  it("메모 textarea 변경 → onNoteChange 호출", () => {
    const onNote = vi.fn();
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={onNote}
        onRemove={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("신입학 메모") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "5/20 마감" } });
    expect(onNote).toHaveBeenCalledWith("5/20 마감");
  });

  it("PR-5: showSubstituteSelect=false → 백업자 select 미렌더링", () => {
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
        showSubstituteSelect={false}
      />,
    );
    expect(screen.queryByLabelText("신입학 백업자")).toBeNull();
  });

  it("PR-5: showSubstituteSelect 미지정 (default true) → 백업자 select 노출", () => {
    render(
      <ServiceCard
        detail={baseDetail}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("신입학 백업자")).toBeInTheDocument();
  });

  it("메모 비움 → onNoteChange(null)", () => {
    const onNote = vi.fn();
    render(
      <ServiceCard
        detail={{ ...baseDetail, note_md: "기존 메모" }}
        backupOperators={operators}
        contactCandidates={contactCandidates}
        onSubstituteChange={vi.fn()}
        onContactsChange={vi.fn()}
        onNoteChange={onNote}
        onRemove={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("신입학 메모") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "" } });
    expect(onNote).toHaveBeenCalledWith(null);
  });
});
