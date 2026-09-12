import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthWidget } from "@/components/AuthWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Business Briefing & Intelligence Publisher",
  description: "Multi-Agent 파이프라인으로 5분 만에 완성하는 C-Level 브리핑",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-end border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <AuthWidget />
        </header>
        {children}
      </body>
    </html>
  );
}
