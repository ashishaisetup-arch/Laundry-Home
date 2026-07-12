import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
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
        className={`${inter.variable} ${jakarta.variable} ${mono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
