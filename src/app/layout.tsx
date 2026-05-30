import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "TeraBooks Player — Stream TeraBox links instantly",
  description:
    "Paste a public TeraBox link and stream it inside a clean OTT-style player. Watch history, resume playback, and quality switching included.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  openGraph: {
    title: "TeraBooks Player",
    description:
      "Stream public TeraBox videos inside a custom player — no redirects.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-slate-100 antialiased">
        {/* Decorative background */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-radial-glow"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.18] bg-grid-faint [background-size:42px_42px]"
        />
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Built for personal use with publicly shared TeraBox links. We never
          bypass authentication or DRM.
        </footer>
      </body>
    </html>
  );
}
