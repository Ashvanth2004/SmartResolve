import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/lib/app-shell";
import { ToastContainer } from "@/lib/ui/toast";
import { SplashScreen } from "@/lib/ui/splash-screen";

export const metadata: Metadata = {
  title: {
    default: "ResolveAI — AI-Powered Complaint Classification & Resolution",
    template: "%s | ResolveAI",
  },
  description:
    "ResolveAI automatically classifies, prioritises and routes customer complaints using AI, then tracks every complaint through its complete resolution lifecycle.",
  applicationName: "ResolveAI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0606" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-app text-foreground antialiased">
        <SplashScreen />
        <Providers>
          <AppShell>{children}</AppShell>
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}