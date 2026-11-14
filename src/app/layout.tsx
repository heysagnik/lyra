import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeInitializer } from "@/components/providers/ThemeInitializer";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

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
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#161616" },
  ],
};

// Runs before first paint so a saved theme never flashes the wrong canvas.
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("lyra-theme");if(t==="light"||t==="dark"||t==="system"){document.documentElement.dataset.theme=t;}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <ThemeInitializer />
      <body className="h-full min-h-full antialiased overscroll-none">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}