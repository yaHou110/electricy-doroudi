import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "الکتریکی درودی | مدیریت کسب‌وکار",
  description: "مدیریت موجودی، فروش و مشتریان",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
