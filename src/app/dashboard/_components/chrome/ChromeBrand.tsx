import Link from "next/link";

export function ChromeBrand() {
  return (
    <Link
      href="/dashboard"
      aria-label="OPS Console — 실시간 현황으로 이동"
      className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
    >
      <span
        aria-hidden
        className="inline-flex h-[22px] w-[26px] items-center justify-center bg-chrome-graphite font-mono text-[13px] font-bold leading-none tracking-[-0.05em] text-chrome-snow"
      >
        &gt;_
      </span>
      <span className="text-base font-extrabold tracking-tight text-chrome-graphite">
        OPS Console
      </span>
    </Link>
  );
}
