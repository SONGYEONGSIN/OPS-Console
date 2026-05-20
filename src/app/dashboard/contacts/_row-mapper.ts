import type { ListRow } from "../_components/patterns/ListPattern";
import type { ContactRow } from "@/features/contacts/schemas";

export function contactRowToListRow(r: ContactRow): ListRow {
  return {
    id: r.id,
    name: r.customer_name,
    status: "active",
    owner: "",
    customerActive: r.customer_active,
    jobTitle: r.job_title,
    universityName: r.university_name,
    departmentName: r.department_name,
    jobRole: r.job_role,
    managementGrade: r.management_grade,
    relationshipGrade: r.relationship_grade,
    contactPhone: r.contact_phone,
    contactExt: r.contact_ext,
    contactEmail: r.contact_email,
  };
}
