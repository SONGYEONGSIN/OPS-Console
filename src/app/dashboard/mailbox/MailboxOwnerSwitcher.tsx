"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type OwnerOption = { email: string; label: string };

/** [내 메일함 ▼] — 본인 + 위임받은 메일함 전환. ?owner= 네비게이션. */
export function MailboxOwnerSwitcher({
  options,
  current,
}: {
  options: OwnerOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (options.length <= 1) return null;

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("owner", v);
    else next.delete("owner");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <select
      aria-label="메일함 선택"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
    >
      {options.map((o) => (
        <option key={o.email} value={o.email}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
