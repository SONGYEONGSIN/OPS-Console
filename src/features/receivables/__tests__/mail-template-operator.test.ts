import { describe, it, expect } from "vitest";
import {
  buildOperatorReminderSubject,
  buildOperatorReminderHtml,
} from "../mail-template-operator";
import type { OperatorReminderGroup } from "../operator-mail-grouping";

const group: OperatorReminderGroup = {
  operator: { name: "김슬기", email: "bluewhich87@jinhakapply.com" },
  items: [
    {
      customerName: "가천대",
      invoiceDate: "2026-04-10",
      description: "전형료 정산",
      daysOverdue: 30,
      amount: 100000,
      operatorLabel: "김슬기",
    },
    {
      customerName: "고려대",
      invoiceDate: "2026-04-15",
      description: "추가 서비스",
      daysOverdue: 25,
      amount: 50000,
      operatorLabel: "김슬기",
    },
  ],
  totalAmount: 150000,
};

describe("buildOperatorReminderSubject", () => {
  it("운영부 상황실 브랜드 prefix + '미수채권 확인 알림' 형식", () => {
    const subject = buildOperatorReminderSubject();
    expect(subject).toContain("[운영부 상황실]");
    expect(subject).toContain("미수채권 확인 알림");
  });
});

describe("buildOperatorReminderHtml", () => {
  it("운영자 이름 + 거래처명 + 청구금액 + 경과일수 노출", () => {
    const html = buildOperatorReminderHtml({ group });
    expect(html).toContain("김슬기");
    expect(html).toContain("가천대");
    expect(html).toContain("고려대");
    expect(html).toContain("100,000");
    expect(html).toContain("50,000");
    expect(html).toContain("D+30");
    expect(html).toContain("D+25");
  });

  it("알림 전용 — 입금완료 액션 버튼/링크 미노출 (PR-2 자동 매칭이 K열 자동 처리)", () => {
    const html = buildOperatorReminderHtml({ group });
    // 표 본문에 액션 버튼 anchor 없음 (인용구나 안내문구의 '입금완료' 텍스트는 허용)
    expect(html).not.toMatch(/<a\s[^>]*입금완료/);
    expect(html).not.toContain("?date=");
    // 안내 문구로 자동 처리 사실 노출
    expect(html).toContain("자동");
  });

  it("브랜드 로고 cid 이미지 포함", () => {
    const html = buildOperatorReminderHtml({ group });
    expect(html).toContain('src="cid:opslogo"');
    expect(html).toContain('alt="운영부 상황실"');
  });

  it("FUN_QUOTES 인용구 1개 포함 (인용 wrapper 노출)", () => {
    const html = buildOperatorReminderHtml({ group });
    // 인용구 wrapper class 또는 quote prefix 검증
    expect(html).toMatch(/💬|<em>/);
  });

  it("안내 문구 — 운영부 상황실 표기 + 학교 담당자 30일 안내, OPS-Console 미노출", () => {
    const html = buildOperatorReminderHtml({ group });
    expect(html).toContain(
      "운영부 상황실에서 미수채권을 입금 내역을 체크하여 관리대장에 '입금완료' 표기합니다.",
    );
    expect(html).toContain(
      "30일 경과하지 않도록 학교 담당자 항목에 이메일을 작성하여 인지할 수 있도록해 주세요.",
    );
    expect(html).toContain("본 알림 메일은 운영부 상황실에서 자동 발송되었습니다.");
    // 브랜드 규칙: 메일 본문에 OPS-Console 노출 금지
    expect(html).not.toContain("OPS-Console");
  });

  it("XSS 방지 — 거래처명에 HTML 태그 들어와도 escape", () => {
    const evil: OperatorReminderGroup = {
      ...group,
      items: [{ ...group.items[0], customerName: "<script>alert(1)</script>" }],
    };
    const html = buildOperatorReminderHtml({ group: evil });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
