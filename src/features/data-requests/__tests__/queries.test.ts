import { describe, it, expect } from "vitest";
import {
  toRecipients,
  filterRecipients,
  latestSentByService,
  type DataRequestRecipient,
} from "../queries";

const contacts = [
  { customer_name: "김담당", university_name: "조선대학교", department_name: "입학처", contact_email: "kim@u.ac.kr" },
  { customer_name: "이담당", university_name: "조선대학교", department_name: null, contact_email: null },
  { customer_name: "박담당", university_name: "부산대학교", department_name: "교무처", contact_email: "park@p.ac.kr" },
];

describe("toRecipients", () => {
  it("이메일 있는 연락처만 변환", () => {
    const r = toRecipients(contacts);
    expect(r).toEqual([
      { email: "kim@u.ac.kr", name: "김담당", department: "입학처", universityName: "조선대학교" },
      { email: "park@p.ac.kr", name: "박담당", department: "교무처", universityName: "부산대학교" },
    ]);
  });
});

describe("filterRecipients", () => {
  const recs: DataRequestRecipient[] = toRecipients(contacts);
  it("대학명으로 필터", () => {
    expect(filterRecipients(recs, "조선대학교", "").map((r) => r.email)).toEqual(["kim@u.ac.kr"]);
  });
  it("검색어(이름/이메일) 부분일치", () => {
    expect(filterRecipients(recs, "부산대학교", "park").length).toBe(1);
    expect(filterRecipients(recs, "부산대학교", "없음").length).toBe(0);
  });
});

describe("latestSentByService", () => {
  it("서비스별 가장 최근 sent_at 선택", () => {
    const rows = [
      { service_id: "a", sent_at: "2026-05-20T01:00:00Z" },
      { service_id: "a", sent_at: "2026-05-22T03:00:00Z" },
      { service_id: "b", sent_at: "2026-05-21T00:00:00Z" },
    ];
    expect(latestSentByService(rows)).toEqual({
      a: "2026-05-22T03:00:00Z",
      b: "2026-05-21T00:00:00Z",
    });
  });
  it("service_id 또는 sent_at이 null인 행은 무시", () => {
    const rows = [
      { service_id: null, sent_at: "2026-05-22T03:00:00Z" },
      { service_id: "a", sent_at: null },
    ];
    expect(latestSentByService(rows)).toEqual({});
  });
});
