import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeInitializer } from "@/components/providers/ThemeInitializer";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "lyra — chat agent",
  description: "A chat agent with persistent memory and live web search",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <ThemeInitializer />
      <body className="h-full min-h-full antialiased overscroll-none">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}