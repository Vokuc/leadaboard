import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://leagueboard.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'LeagueBoard | Real-Time Leaderboard as a Service',
    template: '%s | LeagueBoard',
  },
  description:
    'Create customizable, real-time leaderboards for gaming tournaments, sports clubs, fitness groups, and corporate sales targets in under a minute without writing code.',
  openGraph: {
    type: 'website',
    siteName: 'LeagueBoard',
    title: 'LeagueBoard | Real-Time Leaderboard as a Service',
    description:
      'Create customizable, real-time leaderboards for gaming, sports, fitness, and workplace competitions in under a minute — no code required.',
    url: BASE_URL,
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'LeagueBoard — Real-Time Leaderboard Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LeagueBoard | Real-Time Leaderboard as a Service',
    description:
      'Create customizable, real-time leaderboards for gaming, sports, fitness, and workplace competitions in under a minute.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col font-sans bg-background text-foreground`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
