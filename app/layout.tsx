import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "BeneBot explains the bill you received, refreshes the benefits you have now, and opens a real follow-up case with your provider — in English or Spanish.";

export const metadata: Metadata = {
  title: {
    default: "BeneBot — the medical bill, explained out loud",
    template: "%s · BeneBot",
  },
  description,
  applicationName: "BeneBot",
  openGraph: {
    title: "BeneBot — the medical bill, explained out loud",
    description,
    siteName: "BeneBot",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "BeneBot", description },
  // This build is a synthetic-data demonstration and should never be indexed
  // alongside anything that looks like a real patient billing portal.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
