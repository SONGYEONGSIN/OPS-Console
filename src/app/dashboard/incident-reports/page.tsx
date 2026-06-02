import { redirect } from "next/navigation";

// 경위서는 사고보고(incidents) 인스펙터 탭으로 통합됨.
// 북마크 보호를 위해 라우트는 유지하되 사고보고로 리다이렉트한다.
export default function IncidentReportsPage() {
  redirect("/dashboard/incidents");
}
