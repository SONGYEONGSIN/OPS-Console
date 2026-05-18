import { describe, it, expect } from "vitest";
import { mapProgressJoinRow } from "../progress-queries";

describe("mapProgressJoinRow", () => {
  it("services join 객체를 평면화하여 university_name/service_name 노출", () => {
    const r = mapProgressJoinRow({
      id: "p1",
      service_id: "s1",
      from_email: "from@x.com",
      from_name: "From",
      to_email: "to@x.com",
      to_name: "To",
      status: "in_progress",
      notes: "메모",
      confirmed_at: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
      services: {
        service_id: 6007001,
        university_name: "한예종",
        service_name: "KARTS",
      },
    });
    expect(r.id).toBe("p1");
    expect(r.service_number).toBe(6007001);
    expect(r.university_name).toBe("한예종");
    expect(r.service_name).toBe("KARTS");
    expect(r.status).toBe("in_progress");
    expect(r.notes).toBe("메모");
  });

  it("services join이 null이면 university_name/service_name fallback ('—')", () => {
    const r = mapProgressJoinRow({
      id: "p2",
      service_id: "s2",
      from_email: "from@x.com",
      from_name: "From",
      to_email: "to@x.com",
      to_name: "To",
      status: "completed",
      notes: null,
      confirmed_at: "2026-05-17T00:00:00Z",
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
      services: null,
    });
    expect(r.university_name).toBe("—");
    expect(r.service_name).toBe("—");
    expect(r.service_number).toBeNull();
  });
});
