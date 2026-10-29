import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
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
  title: "MyJooba",
  description: "Your conversations, turned into useful work.",
};

import { QueryProvider } from "@/components/query-provider";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
