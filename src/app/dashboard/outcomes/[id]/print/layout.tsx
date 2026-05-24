import "@/app/globals.css";

/**
 * 인쇄 전용 layout — DashboardShell(사이드바/chrome) 우회.
 * 브라우저 인쇄(Cmd+P)로 PDF 변환 시 가독성 + A4 톤 유지.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-cream text-ink">
        <div className="mx-auto max-w-[800px] p-8 print:p-0">{children}</div>
      </body>
    </html>
  );
}
