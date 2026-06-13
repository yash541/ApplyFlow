import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ApplyFlow AI — Your Career Operating System",
    template: "%s | ApplyFlow AI",
  },
  description:
    "AI-powered job search platform. Tailor resumes, track applications, ace interviews — all in one place.",
  keywords: ["AI resume", "job application tracker", "career AI", "LinkedIn automation"],
  metadataBase: new URL("https://www.applyflow.in"),
  alternates: {
    canonical: "https://www.applyflow.in",
  },
  openGraph: {
    title: "ApplyFlow AI",
    description: "Your AI-powered career operating system",
    type: "website",
    url: "https://www.applyflow.in",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
