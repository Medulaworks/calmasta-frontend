import type { Metadata, Viewport } from "next";
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
  title: "Joobah",
  description: "Your conversations, turned into useful work.",
  applicationName: "Joobah",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: { title: "Joobah", description: "Your conversations, turned into useful work.", siteName: "Joobah", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Joobah" }] },
  twitter: { card: "summary_large_image", title: "Joobah", description: "Your conversations, turned into useful work.", images: ["/og-image.png"] },
};

export const viewport: Viewport = { themeColor: "#6D0016" };

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
