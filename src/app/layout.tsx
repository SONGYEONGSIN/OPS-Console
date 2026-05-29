import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "운영부 상황실",
  description: "에디토리얼 톤 사내 운영 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
