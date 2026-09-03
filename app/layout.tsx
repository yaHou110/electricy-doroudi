import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "درودیان | مدیریت پخش",
  description: "مدیریت موجودی و فروش تجهیزات برق",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
