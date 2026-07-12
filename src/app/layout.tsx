import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Laundry Home — AI-Powered Laundry Aggregator",
  description:
    "Book premium laundry services from verified vendors near you. Pickup, wash, iron, dry-clean and deliver — track every stage in real time.",
  keywords: [
    "laundry",
    "laundry service",
    "dry cleaning",
    "wash and fold",
    "laundry aggregator",
    "pickup laundry",
  ],
  authors: [{ name: "Laundry Home" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Laundry Home — AI-Powered Laundry Aggregator",
    description: "Book premium laundry services from verified vendors near you.",
    siteName: "Laundry Home",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${mono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
