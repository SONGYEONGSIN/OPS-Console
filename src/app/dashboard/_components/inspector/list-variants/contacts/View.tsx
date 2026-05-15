import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

export function ContactsView({ row }: ViewProps) {
  return (
    <div className="space-y-6">
      <Section title="기본">
        <DefList
          items={[
            {
              term: "활성화",
              desc: (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.customerActive ?? "-"}
                </span>
              ),
            },
            { term: "고객명", desc: row.name || "-" },
            { term: "직함", desc: row.jobTitle || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="소속">
        <DefList
          items={[
            { term: "대학명", desc: row.universityName || "-" },
            { term: "소속부서", desc: row.departmentName || "-" },
            { term: "직책", desc: row.jobRole || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="등급">
        <DefList
          items={[
            {
              term: "관리 등급",
              desc: row.managementGrade ? (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.managementGrade}
                </span>
              ) : (
                "-"
              ),
            },
            {
              term: "관계 등급",
              desc: row.relationshipGrade ? (
                <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                  {row.relationshipGrade}
                </span>
              ) : (
                "-"
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="연락처">
        <DefList
          items={[
            { term: "휴대폰", desc: row.contactPhone || "-" },
            { term: "내선", desc: row.contactExt || "-" },
            { term: "이메일", desc: row.contactEmail || "-" },
          ]}
        />
      </Section>
    </div>
  );
}
