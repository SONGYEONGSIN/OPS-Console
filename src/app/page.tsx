import { redirect } from "next/navigation";

/**
 * `/` 진입점.
 *
 * middleware(`src/middleware.ts`)가 미인증 사용자를 이미 `/login`으로 끌어내리므로
 * 이 페이지에는 인증된 사용자만 도달한다. 따라서 무조건 `/dashboard`로 보낸다.
 */
export default function RootPage() {
  redirect("/dashboard");
}
