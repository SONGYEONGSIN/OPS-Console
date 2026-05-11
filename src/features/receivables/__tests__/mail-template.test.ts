import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  formatWon,
  buildReminderHtml,
  buildReminderSubject,
} from "../mail-template";
import type { ReminderGroup } from "../mail-schemas";

const singleCustomerGroup: ReminderGroup = {
  recipient: { email: "manager@school.ac.kr", name: "김교사" },
  items: [
    {
      customerName: "○○대학교",
      invoiceDate: "2026-04-01",
      description: "수시 원서접수 시스템 4월",
      daysOverdue: 12,
      amount: 1_500_000,
      operatorLabel: "송영신",
    },
  ],
  totalAmount: 1_500_000,
};

const multiCustomerGroup: ReminderGroup = {
  recipient: { email: "head@bigschool.ac.kr" },
  items: [
    {
      customerName: "A학교",
      invoiceDate: "2026-04-01",
      description: "원서 4월",
      daysOverdue: 12,
      amount: 1_000_000,
      operatorLabel: "송영신",
    },
    {
      customerName: "B학교",
      invoiceDate: "2026-04-15",
      description: "원서 4월",
      daysOverdue: 11,
      amount: 500_000,
      operatorLabel: "송영신",
    },
  ],
  totalAmount: 1_500_000,
};

describe("escapeHtml", () => {
  it("<script> 태그 이스케이프", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("& 따옴표도 이스케이프", () => {
    expect(escapeHtml(`A & "B" 'C'`)).toBe(
      "A &amp; &quot;B&quot; &#39;C&#39;",
    );
  });
});

describe("formatWon", () => {
  it("천 단위 구분 + 원 접미사", () => {
    expect(formatWon(1_234_567)).toBe("1,234,567원");
  });

  it("0원도 정상 포맷", () => {
    expect(formatWon(0)).toBe("0원");
  });
});

describe("buildReminderSubject", () => {
  it("단일 거래처: '○○대학교 세금계산서 확인 요청'", () => {
    const s = buildReminderSubject({
      group: singleCustomerGroup,
      companyName: "Folio",
    });
    expect(s).toContain("○○대학교");
    expect(s).toContain("세금계산서");
  });

  it("복수 거래처: 회사명만 표기", () => {
    const s = buildReminderSubject({
      group: multiCustomerGroup,
      companyName: "Folio",
    });
    expect(s).toContain("Folio");
    expect(s).toContain("세금계산서");
  });
});

describe("buildReminderHtml", () => {
  it("발신자 이름 포함 + 회사명 포함", () => {
    const html = buildReminderHtml({
      group: singleCustomerGroup,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).toContain("송영신");
    expect(html).toContain("Folio");
  });

  it("단일 거래처일 때 거래처명을 본문에 표기", () => {
    const html = buildReminderHtml({
      group: singleCustomerGroup,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).toContain("○○대학교");
  });

  it("복수 거래처일 때 '귀사'로 표기 + 모든 거래처 table에 노출", () => {
    const html = buildReminderHtml({
      group: multiCustomerGroup,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).toContain("귀사");
    expect(html).toContain("A학교");
    expect(html).toContain("B학교");
  });

  it("악성 입력 (description에 <script>) → 이스케이프되어 출력", () => {
    const evil: ReminderGroup = {
      ...singleCustomerGroup,
      items: [
        {
          ...singleCustomerGroup.items[0],
          description: "<script>alert('xss')</script>",
        },
      ],
    };
    const html = buildReminderHtml({
      group: evil,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("금액 포맷 천단위 콤마 포함", () => {
    const html = buildReminderHtml({
      group: singleCustomerGroup,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).toContain("1,500,000");
  });

  it("경과일수에 'D+' 접두", () => {
    const html = buildReminderHtml({
      group: singleCustomerGroup,
      senderName: "송영신",
      companyName: "Folio",
    });
    expect(html).toContain("D+12");
  });
});
