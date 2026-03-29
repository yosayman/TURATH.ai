import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Hassani AI — Moroccan Cultural Expert",
  description:
    "An AI-powered cultural assistant specializing in Moroccan and Hassani heritage, traditions, and knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-[100dvh] overflow-hidden antialiased`}
    >
      <body className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
