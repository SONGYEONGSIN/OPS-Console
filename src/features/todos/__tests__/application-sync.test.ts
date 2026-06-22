import { describe, it, expect } from "vitest";
import { computeMissingApplicationTodos } from "../application-sync";
import type { ServicesRow } from "@/features/services/schemas";
import type { TodoRow } from "../schemas";

const ME = "me@x.com";

function svc(p: Partial<ServicesRow>): ServicesRow {
  return {
    id: p.id ?? "00000000-0000-0000-0000-000000000001",
    service_id: 1,
    application_type: "수시",
    region: "서울",
    university_name: "숙명여대",
    service_name: "Fall Admission",
    university_type: "대학",
    category: "원서접수",
    operator_email: ME,
    operator_name: "나",
    developer_email: null,
    developer_name: null,
    write_start_at: "2026-06-24T00:00:00+09:00",
    write_end_at: "2026-06-30T00:00:00+09:00",
    pay_start_at: null,
    pay_end_at: null,
    solo: false,
    source: "moa",
    imported_at: null,
    created_at: "2026-06-01T00:00:00+09:00",
    updated_at: "2026-06-01T00:00:00+09:00",
    ...p,
  };
}

function todo(p: Partial<TodoRow>): TodoRow {
  return {
    id: p.id ?? crypto.randomUUID(),
    title: "t",
    done: false,
    priority: "medium",
    assignee_email: ME,
    created_by_email: ME,
    created_at: "2026-06-01T00:00:00+09:00",
    updated_at: "2026-06-01T00:00:00+09:00",
    ...p,
  };
}

describe("computeMissingApplicationTodos", () => {
  it("연결된 todo 없는 service → create payload 생성", () => {
    const r = computeMissingApplicationTodos([svc({ id: "s1" })], [], ME);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      title: "숙명여대 - Fall Admission",
      category: "원서접수",
      due_at: "2026-06-24T00:00:00+09:00",
      source_service_id: "s1",
      status: "todo",
      priority: "medium",
      assignee_email: ME,
      created_by_email: ME,
    });
  });

  it("이미 active todo 연결된 service → skip(멱등)", () => {
    const existing = [todo({ source_service_id: "s1", auto_dismissed: false })];
    const r = computeMissingApplicationTodos([svc({ id: "s1" })], existing, ME);
    expect(r).toHaveLength(0);
  });

  it("dismissed todo 연결된 service → skip(삭제 존중, 재생성 안 함)", () => {
    const existing = [todo({ source_service_id: "s1", auto_dismissed: true })];
    const r = computeMissingApplicationTodos([svc({ id: "s1" })], existing, ME);
    expect(r).toHaveLength(0);
  });

  it("write_start_at 없는 service → 제외", () => {
    const r = computeMissingApplicationTodos(
      [svc({ id: "s1", write_start_at: null })],
      [],
      ME,
    );
    expect(r).toHaveLength(0);
  });

  it("여러 service 중 연결 안 된 것만 생성", () => {
    const services = [svc({ id: "s1" }), svc({ id: "s2" }), svc({ id: "s3" })];
    const existing = [todo({ source_service_id: "s2" })];
    const r = computeMissingApplicationTodos(services, existing, ME);
    expect(r.map((x) => x.source_service_id).sort()).toEqual(["s1", "s3"]);
  });

  it("source_service_id 없는 수동 todo는 멱등 판단에 영향 없음", () => {
    const existing = [todo({ source_service_id: null })];
    const r = computeMissingApplicationTodos([svc({ id: "s1" })], existing, ME);
    expect(r).toHaveLength(1);
  });
});
